import React, { useState, useRef, useEffect, Suspense, lazy } from "react";
import styled, { keyframes, css } from "styled-components";
import axios from "axios";
import { IoMdSend, IoMdClose, IoMdCheckmark } from "react-icons/io";
import {
  BsEmojiSmileFill, BsPaperclip, BsMicFill,
  BsStopCircleFill, BsCodeSlash, BsClockHistory, BsTerminal,
} from "react-icons/bs";
import { FaBomb, FaFire, FaCalendarAlt, FaLink, FaSpinner, FaLock, FaMagic, FaSpellCheck } from "react-icons/fa";
import { MdSentimentDissatisfied } from "react-icons/md";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import useChatStore from "../store/chatStore";
import { triggerHaptic } from "../utils/haptics";
import { grammarCheckRoute, toneCheckRoute } from "../utils/APIRoutes";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const CLOUDINARY_CLOUD_NAME  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const COMMANDS = [
  { cmd: "/code",  desc: "Enable Code Mode",        icon: <BsCodeSlash /> },
  { cmd: "/bomb",  desc: "Set 1-hour self-destruct", icon: <FaBomb /> },
  { cmd: "/clear", desc: "Clear current input",      icon: <FaMagic /> },
];

const TONE_META = {
  angry:     { label: "Sounds angry", color: "#ef4444", emoji: "😠" },
  harsh:     { label: "Might come across harsh", color: "#f97316", emoji: "😤" },
  sarcastic: { label: "Could read as sarcastic", color: "#eab308", emoji: "🙃" },
  sad:       { label: "Sounds sad", color: "#60a5fa", emoji: "😢" },
  positive:  { label: null, color: null, emoji: null }, 
  neutral:   { label: null, color: null, emoji: null }, 
};

export default function ChatInput({
  handleSendMsg, handleTyping, replyingTo, setReplyingTo,
  editingMessage, setEditingMessage, handleEditMsgSubmit,
  droppedFile, onClearDrop,
}) {
  const { currentChat, currentUser, theme } = useChatStore();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [msg, setMsg]                   = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording]   = useState(false);
  const [isCodeMode, setIsCodeMode]     = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isUploading, setIsUploading]   = useState(false);
  const [showTimerMenu, setShowTimerMenu]   = useState(false);
  const [timerDuration, setTimerDuration]   = useState(null);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [isViewOnceMedia, setIsViewOnceMedia] = useState(false);
  const [detectedUrl, setDetectedUrl]   = useState(null);
  const [showCommands, setShowCommands] = useState(false);
  const [audioLevels, setAudioLevels]   = useState(Array(15).fill(10));

  // Current message ref strictly for preventing ghost warnings after sent messages
  const currentMsgRef = useRef(msg);
  useEffect(() => { currentMsgRef.current = msg; }, [msg]);

  // ── FIX: Draft Key Bleed ───────────────────────────────────────────────────
  // Isolated to both the user and the chat to prevent cross-account leakage.
  const draftKey = (currentUser && currentChat) 
    ? `draft_${currentUser._id}_${currentChat._id || currentChat.name}` 
    : null;

  useEffect(() => {
    if (!draftKey) return;
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      setMsg(saved);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
      });
    } else {
      setMsg("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  }, [draftKey]);

  // ── Sprint 1: Grammar check ─────────────────────────────────────────────────
  const [grammarSuggestion, setGrammarSuggestion]   = useState(null);
  const [isCheckingGrammar, setIsCheckingGrammar]   = useState(false);

  const handleGrammarCheck = async () => {
    const msgToCheck = msg;
    if (!msgToCheck.trim() || msgToCheck.trim().length < 3 || isCheckingGrammar) return;
    setIsCheckingGrammar(true);
    try {
      const token = currentUser?.token || sessionStorage.getItem("chat-app-token");
      const { data } = await axios.post(grammarCheckRoute, { message: msgToCheck }, { headers: { Authorization: `Bearer ${token}` } });
      
      // FIX: Tone/Grammar Checker Ghost Warnings - Only apply if the message hasn't been sent/changed
      if (currentMsgRef.current === msgToCheck) {
          if (data.status && data.wasChanged) {
            setGrammarSuggestion({ original: msgToCheck, corrected: data.corrected });
          } else {
            toast.success("✓ No issues found!");
          }
      }
    } catch { toast.error("Grammar check unavailable."); }
    finally { 
        if (currentMsgRef.current === msgToCheck) setIsCheckingGrammar(false); 
    }
  };

  // ── Sprint 2: Tone indicator ────────────────────────────────────────────────
  const [toneWarning, setToneWarning]   = useState(null); 
  const [isCheckingTone, setIsCheckingTone] = useState(false);
  const toneDebounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(toneDebounceRef.current);
    const msgToCheck = msg;
    
    if (!msgToCheck.trim() || msgToCheck.trim().length < 15) { setToneWarning(null); return; }
    
    toneDebounceRef.current = setTimeout(async () => {
      setIsCheckingTone(true);
      try {
        const token = currentUser?.token || sessionStorage.getItem("chat-app-token");
        const { data } = await axios.post(toneCheckRoute, { message: msgToCheck }, { headers: { Authorization: `Bearer ${token}` } });
        
        // FIX: Tone/Grammar Checker Ghost Warnings
        if (currentMsgRef.current === msgToCheck) {
            if (data.status && data.warning) {
              const meta = TONE_META[data.tone] || {};
              setToneWarning({ tone: data.tone, label: meta.label, color: meta.color, emoji: meta.emoji });
            } else {
              setToneWarning(null);
            }
        }
      } catch { /* fail silently */ }
      finally { 
          if (currentMsgRef.current === msgToCheck) setIsCheckingTone(false); 
      }
    }, 1500);
    return () => clearTimeout(toneDebounceRef.current);
  }, [msg]);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const streamRef         = useRef(null);
  const textareaRef       = useRef(null);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const fileInputRef      = useRef(null);
  const audioContextRef   = useRef(null);
  const analyzerRef       = useRef(null);
  const animationFrameRef = useRef(null);

  const isChannel = currentChat?.isChannel || false;
  const isAdmin   = currentChat?.admins?.includes(currentUser?._id);
  const isMod     = currentChat?.moderators?.includes(currentUser?._id);
  const canPost   = !isChannel || isAdmin || isMod;
  const hasContent = msg.trim().length > 0 || mediaPreview !== null;

  useEffect(() => {
    if (droppedFile && canPost) { processFile(droppedFile); if (onClearDrop) onClearDrop(); }
  }, [droppedFile, canPost, onClearDrop]);

  useEffect(() => {
    if (editingMessage) {
      setMsg(editingMessage.text); setReplyingTo(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }
  }, [editingMessage, setReplyingTo]);

  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = msg.match(urlRegex);
    setDetectedUrl(match ? match[0] : null);
  }, [msg]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".button-container")) {
        setShowEmojiPicker(false); setShowTimerMenu(false); setShowScheduleMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close().catch(() => {});
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleEmojiClick = (emojiData) => { triggerHaptic("light"); setMsg((p) => p + emojiData.emoji); handleTyping(true); };
  const resetTextarea = () => { if (textareaRef.current) textareaRef.current.style.height = "auto"; };

  const executeCommand = (cmdStr) => {
    triggerHaptic("success");
    if (cmdStr === "/code")  setIsCodeMode(true);
    if (cmdStr === "/bomb")  setTimerDuration(3600);
    if (cmdStr === "/clear") { setMsg(""); setIsCodeMode(false); setTimerDuration(null); }
    setShowCommands(false); setMsg(""); resetTextarea();
  };

  const sendChat = (event) => {
    event?.preventDefault();
    if (mediaPreview && canPost && !isUploading) { confirmSendMedia(); return; }
    if (hasContent && canPost && !isUploading) {
      if (editingMessage) {
        handleEditMsgSubmit(editingMessage.id, msg); setEditingMessage(null);
      } else {
        handleSendMsg(msg, isCodeMode ? "code" : (detectedUrl ? "link" : "text"), replyingTo?.id, {
          timer: timerDuration, scheduledAt: scheduleDate || null, localId: uuidv4(),
        });
      }
      setMsg(""); resetTextarea(); setIsCodeMode(false); setReplyingTo(null);
      handleTyping(false); setShowEmojiPicker(false); setScheduleDate("");
      setShowScheduleMenu(false); setDetectedUrl(null); setShowCommands(false);
      setToneWarning(null); setGrammarSuggestion(null);
      if (draftKey) localStorage.removeItem(draftKey);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setMsg(val); handleTyping(val.length > 0);
    if (draftKey) { if (val) localStorage.setItem(draftKey, val); else localStorage.removeItem(draftKey); }
    setShowCommands(val.startsWith("/"));
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showCommands && COMMANDS.some((c) => msg.startsWith(c.cmd))) executeCommand(msg.trim());
      else sendChat();
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024, sizes = ["Bytes","KB","MB","GB"], i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      let type = "file";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("video/")) type = "video";
      triggerHaptic("medium");
      setMediaPreview({ src: reader.result, type, rawFile: file, fileName: file.name, fileSize: formatFileSize(file.size) });
      setIsViewOnceMedia(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    if (e.clipboardData.files?.length > 0 && canPost) { e.preventDefault(); processFile(e.clipboardData.files[0]); }
  };

  const handleFileUpload = (e) => { if (e.target.files[0] && canPost) processFile(e.target.files[0]); e.target.value = null; };

  const uploadToCloudinary = async (file, resourceType = "auto") => {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) { console.error("[Media] Cloudinary env vars not set."); return null; }
    const formData = new FormData();
    formData.append("file", file); formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, formData, { withCredentials: false });
      return res.data.secure_url;
    } catch (error) { console.error("[Media] Cloudinary Upload Error:", error); return null; }
  };

  const confirmSendMedia = async () => {
    if (!mediaPreview?.rawFile || !canPost) return;
    setIsUploading(true);
    let resType = "auto", fileToUpload = mediaPreview.rawFile;
    if (mediaPreview.type === "video") { resType = "video"; }
    else if (mediaPreview.type === "image") {
      resType = "image";
      try {
        const imageCompression = (await import("browser-image-compression")).default;
        fileToUpload = await imageCompression(mediaPreview.rawFile, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      } catch {}
    } else { resType = "raw"; }

    const cloudUrl = await uploadToCloudinary(fileToUpload, resType);
    setIsUploading(false);
    
    if (cloudUrl) {
      const pendingReply = replyingTo;
      handleSendMsg(cloudUrl, mediaPreview.type, replyingTo?.id, { isViewOnce: isViewOnceMedia, fileName: mediaPreview.fileName, fileSize: formatFileSize(fileToUpload.size), localId: uuidv4() });
      
      // FIX: Lost Context on "Reply To"
      // Ensure the text message is queued with the reply ID BEFORE we nullify it locally.
      if (msg.trim().length > 0) {
          const textToSend = msg;
          setMsg(""); 
          resetTextarea();
          setMediaPreview(null);
          setTimeout(() => { 
              handleSendMsg(textToSend, "text", pendingReply?.id, {}); 
              setReplyingTo(null); 
          }, 200);
      } else {
          setMediaPreview(null);
          setReplyingTo(null);
      }
    } else { toast.error("Media upload failed. Please try again."); }
  };

  const startRecording = async () => {
    if (!canPost) return;
    try {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      audioContextRef.current.createMediaStreamSource(stream).connect(analyzerRef.current);
      analyzerRef.current.fftSize = 64;
      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
      
      const updateWaveform = () => {
        if (!analyzerRef.current) return;
        analyzerRef.current.getByteFrequencyData(dataArray);
        const step = Math.floor(dataArray.length / 15);
        setAudioLevels(Array.from({ length: 15 }, (_, i) => Math.max(10, dataArray[i * step] / 2)));
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      
      updateWaveform();
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        audioContextRef.current?.close().catch(() => {});
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.mp3`, { type: "audio/mp3" });
        setIsUploading(true);
        const cloudUrl = await uploadToCloudinary(audioFile, "video");
        setIsUploading(false);
        if (cloudUrl) { handleSendMsg(cloudUrl, "audio", replyingTo?.id, { timer: timerDuration, localId: uuidv4() }); setReplyingTo(null); }
        else toast.error("Failed to send audio message.");
      };
      triggerHaptic("medium"); mediaRecorder.start(); setIsRecording(true);
    } catch (error) {
      // FIX: Undefined Behavior on Cancelled Audio - clean up state so UI isn't stuck
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setIsRecording(false);
      toast.warning("Microphone access denied.");
    }
  };

  const stopRecording = () => { if (mediaRecorderRef.current) { triggerHaptic("heavy"); mediaRecorderRef.current.stop(); setIsRecording(false); } };
  const toggleTimer = (d) => { triggerHaptic("light"); setTimerDuration(timerDuration === d ? null : d); setShowTimerMenu(false); };

  if (!canPost) {
    return (
      <Wrapper>
        <ReadOnlyBanner><FaLock className="lock-icon" /><span>Only admins and moderators can send messages here.</span></ReadOnlyBanner>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {showCommands && (
        <CommandPalette>
          <div className="cmd-header"><BsTerminal /> Slash Commands</div>
          {COMMANDS.map((cmd, i) => (
            <div key={i} className="cmd-item" onClick={() => executeCommand(cmd.cmd)}>
              <span className="cmd-icon">{cmd.icon}</span>
              <span className="cmd-name">{cmd.cmd}</span>
              <span className="cmd-desc">{cmd.desc}</span>
            </div>
          ))}
        </CommandPalette>
      )}

      <div className="status-badges">
        {timerDuration && (
          <div className="badge timer-badge" onClick={() => setTimerDuration(null)}>
            <FaBomb /> Disappears in {timerDuration >= 86400 ? `${timerDuration/86400}d` : `${timerDuration/3600}h`} <IoMdClose className="close" />
          </div>
        )}
        {scheduleDate && (
          <div className="badge schedule-badge" onClick={() => setScheduleDate("")}>
            <FaCalendarAlt /> Scheduled <IoMdClose className="close" />
          </div>
        )}
      </div>

      {toneWarning && toneWarning.label && (
        <div className="reply-banner" style={{ background: `${toneWarning.color}14`, borderTop: `1px solid ${toneWarning.color}33` }}>
          <MdSentimentDissatisfied style={{ color: toneWarning.color, marginRight: 6, fontSize: "1rem" }} />
          <span style={{ color: toneWarning.color, fontWeight: 600 }}>
            {toneWarning.emoji} {toneWarning.label} — consider rephrasing
          </span>
          <IoMdClose onClick={() => setToneWarning(null)} className="close-btn" />
        </div>
      )}

      {grammarSuggestion && (
        <div className="reply-banner" style={{ background: "rgba(34,211,165,0.06)", borderTop: "1px solid rgba(34,211,165,0.2)" }}>
          <span>✨ Suggestion: <strong>{grammarSuggestion.corrected}</strong></span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => { setMsg(grammarSuggestion.corrected); if (draftKey) localStorage.setItem(draftKey, grammarSuggestion.corrected); setGrammarSuggestion(null); }}
              style={{ background: "none", border: "none", color: "var(--color-success)", cursor: "pointer", fontWeight: 700, fontSize: "var(--text-xs)", fontFamily: "inherit" }}
            >Apply</button>
            <IoMdClose onClick={() => setGrammarSuggestion(null)} className="close-btn" />
          </div>
        </div>
      )}

      {detectedUrl && !isRecording && !isCodeMode && (
        <div className="reply-banner link-banner">
          <FaLink style={{ marginRight: 8, color: "#34B7F1" }} />
          <span>Link detected: A rich preview will be generated when sent.</span>
        </div>
      )}

      {replyingTo && !editingMessage && (
        <div className="reply-banner">
          <span>Replying to: <strong>{replyingTo.text.substring(0, 30)}…</strong></span>
          <IoMdClose onClick={() => { triggerHaptic("light"); setReplyingTo(null); }} className="close-btn" />
        </div>
      )}

      {editingMessage && (
        <div className="reply-banner edit-banner">
          <span>Editing message…</span>
          <IoMdClose onClick={() => { triggerHaptic("light"); setEditingMessage(null); setMsg(""); resetTextarea(); }} className="close-btn" />
        </div>
      )}

      {mediaPreview && (
        <PreviewOverlay>
          <div className="preview-container">
            <div className="preview-header">
              <span>Preview {mediaPreview.type}</span>
              {!isUploading && <IoMdClose onClick={() => { triggerHaptic("light"); setMediaPreview(null); }} className="close-btn" />}
            </div>
            {mediaPreview.type === "image" && <img src={mediaPreview.src} alt="Preview" />}
            {mediaPreview.type === "video" && <video src={mediaPreview.src} controls />}
            {mediaPreview.type === "file" && <div className="file-preview-icon">📄 {mediaPreview.fileName}<br />({mediaPreview.fileSize})</div>}
            <div className="media-options">
              <label className={`view-once-toggle ${isViewOnceMedia ? "active" : ""}`}>
                <input id="view-once" name="view-once" type="checkbox" disabled={isUploading} checked={isViewOnceMedia} onChange={(e) => { triggerHaptic("light"); setIsViewOnceMedia(e.target.checked); }} hidden />
                <FaFire /> {isViewOnceMedia ? "View Once Enabled" : "Send as View Once"}
              </label>
            </div>
            <div className="preview-actions">
              <input id="media-caption" name="media-caption" type="text" disabled={isUploading} placeholder="Add a caption…" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <button disabled={isUploading} onClick={confirmSendMedia}>
                {isUploading ? <FaSpinner className="spin-icon" /> : <IoMdSend />}
              </button>
            </div>
          </div>
        </PreviewOverlay>
      )}

      <Container $isRecording={isRecording}>
        <div className="button-container">
          <div className="emoji tool-toggle">
            <BsEmojiSmileFill onClick={(e) => { e.stopPropagation(); triggerHaptic("light"); setShowEmojiPicker(!showEmojiPicker); setShowTimerMenu(false); setShowScheduleMenu(false); }} />
            {showEmojiPicker && (
              <div className="floating-menu emoji-picker-react" onClick={(e) => e.stopPropagation()}>
                <Suspense fallback={<div style={{ padding: "1.5rem", color: "var(--text-dim)", fontSize: "var(--text-sm)" }}>Loading Emojis…</div>}>
                  <EmojiPicker theme={theme === "light" ? "light" : "dark"} onEmojiClick={handleEmojiClick} />
                </Suspense>
              </div>
            )}
          </div>

          <div className="upload tool-toggle" onClick={() => { if (!isUploading) { triggerHaptic("light"); fileInputRef.current.click(); } }} title="Attach File">
            <BsPaperclip />
            <input id="file-upload" name="file-upload" type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar" onChange={handleFileUpload} />
          </div>

          <div className="mic tool-toggle" onClick={isRecording ? stopRecording : startRecording} title="Record Audio">
            {isRecording ? <BsStopCircleFill className="recording-active" /> : (isUploading ? <FaSpinner className="spin-icon loading-mic" /> : <BsMicFill />)}
          </div>

          <div className={`tool-toggle ${timerDuration ? "active" : ""}`} title="Self-Destruct Timer">
            <FaBomb onClick={(e) => { e.stopPropagation(); triggerHaptic("light"); setShowTimerMenu(!showTimerMenu); setShowEmojiPicker(false); setShowScheduleMenu(false); }} />
            {showTimerMenu && (
              <div className="floating-menu timer-menu" onClick={(e) => e.stopPropagation()}>
                <h4>Self-Destruct</h4>
                {[null,3600,86400,604800].map((d) => (
                  <button key={d} className={timerDuration === d ? "selected" : ""} onClick={() => toggleTimer(d)}>
                    {d === null ? "Off" : d === 3600 ? "1 Hour" : d === 86400 ? "1 Day" : "1 Week"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`tool-toggle ${scheduleDate ? "active" : ""}`} title="Schedule Message">
            <BsClockHistory onClick={(e) => { e.stopPropagation(); triggerHaptic("light"); setShowScheduleMenu(!showScheduleMenu); setShowEmojiPicker(false); setShowTimerMenu(false); }} />
            {showScheduleMenu && (
              <div className="floating-menu schedule-menu" onClick={(e) => e.stopPropagation()}>
                <h4>Schedule Message</h4>
                <input id="schedule-date" name="schedule-date" type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                <button onClick={() => { triggerHaptic("success"); setShowScheduleMenu(false); }}>Set Schedule</button>
              </div>
            )}
          </div>

          <div className={`code-toggle tool-toggle ${isCodeMode ? "active" : ""}`} onClick={() => { triggerHaptic("light"); setIsCodeMode(!isCodeMode); }} title="Send Code Snippet">
            <BsCodeSlash />
          </div>

          <div className={`tool-toggle ${isCheckingGrammar ? "active" : ""}`} onClick={handleGrammarCheck} title="Check grammar & spelling" style={{ opacity: msg.trim().length < 3 ? 0.4 : 1 }}>
            {isCheckingGrammar ? <FaSpinner className="spin-icon" /> : <FaSpellCheck />}
          </div>
        </div>

        <form className="input-container" onSubmit={sendChat}>
          {isRecording ? (
            <div className="recording-ui">
              <span className="rec-text">Recording Audio… (Click Stop)</span>
              <div className="dynamic-waveform">
                {audioLevels.map((level, i) => <span key={i} className="bar" style={{ height: `${level}px` }} />)}
              </div>
            </div>
          ) : isCodeMode ? (
            <textarea id="code-snippet-input" name="code-snippet-input" placeholder="Paste your code snippet here…" onChange={handleInput} onKeyDown={handleKeyDown} value={msg} onPaste={handlePaste} rows="2" disabled={isUploading} />
          ) : (
            <textarea
              id="chat-message-input" name="chat-message-input" ref={textareaRef}
              placeholder={isUploading ? "Uploading media…" : (showCommands ? "Select a command…" : "Type a message or use '/' for commands…")}
              onChange={handleInput} onKeyDown={handleKeyDown} value={msg} onPaste={handlePaste}
              onBlur={() => handleTyping(false)} disabled={isUploading} rows="1"
            />
          )}
          <button
            type="submit"
            className={`${scheduleDate ? "schedule-btn" : ""} ${hasContent ? "ready" : "empty"}`}
            disabled={isRecording || isUploading || (!hasContent && !mediaPreview)}
          >
            {isUploading ? <FaSpinner className="spin-icon" /> : (editingMessage ? <IoMdCheckmark /> : (scheduleDate ? <BsClockHistory /> : <IoMdSend />))}
          </button>
        </form>
      </Container>
    </Wrapper>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const popIn = keyframes`0%{transform:scale(0.9) translateY(10px);opacity:0;}100%{transform:scale(1) translateY(0);opacity:1;}`;
const pulse = keyframes`0%{transform:scale(1);}50%{transform:scale(1.15);}100%{transform:scale(1);}`;

const ReadOnlyBanner = styled.div`
  display:flex;align-items:center;justify-content:center;
  background:var(--bg-surface);color:var(--text-secondary);
  padding:1rem 1.5rem;border-top:1px solid var(--border-subtle);
  font-style:italic;font-size:var(--text-sm);min-height:64px;gap:8px;
  .lock-icon{font-size:var(--text-base);color:var(--msg-sent);}
`;

const CommandPalette = styled.div`
  position:absolute;bottom:80px;left:1.5rem;width:280px;
  background:var(--glass-noise),var(--bg-panel);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  border:1px solid var(--glass-border);border-radius:var(--radius-lg);
  overflow:hidden;box-shadow:var(--glass-shadow);z-index:100;animation:${popIn} 0.2s var(--ease-spring);
  .cmd-header{padding:9px 14px;background:var(--bg-overlay);font-size:var(--text-2xs);font-weight:800;color:var(--text-secondary);
    display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--border-subtle);text-transform:uppercase;letter-spacing:0.5px;}
  .cmd-item{display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;
    transition:all var(--duration-fast);color:var(--text-primary);&:hover{background:var(--bg-hover);padding-left:18px;}}
  .cmd-icon{color:var(--text-secondary);display:flex;align-items:center;font-size:var(--text-base);}
  .cmd-name{font-weight:700;color:var(--msg-sent);font-size:var(--text-sm);}
  .cmd-desc{font-size:var(--text-xs);color:var(--text-secondary);}
`;

const PreviewOverlay = styled.div`
  position:absolute;bottom:80px;left:0;right:0;display:flex;justify-content:center;z-index:100;
  .preview-container{
    background:var(--glass-noise),var(--bg-panel);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
    border-radius:var(--radius-xl);padding:1.25rem;box-shadow:var(--glass-shadow);border:1px solid var(--glass-border);
    display:flex;flex-direction:column;gap:1rem;width:min(380px,95vw);animation:${popIn} 0.3s var(--ease-spring);color:var(--text-primary);
    .preview-header{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:var(--text-sm);
      .close-btn{cursor:pointer;font-size:var(--text-lg);color:var(--text-secondary);transition:all var(--duration-fast);padding:4px;border-radius:var(--radius-sm);&:hover{color:var(--color-danger);transform:scale(1.1);}}}
    img,video{width:100%;max-height:240px;object-fit:contain;border-radius:var(--radius-md);background:var(--bg-overlay);}
    .file-preview-icon{height:110px;display:flex;align-items:center;justify-content:center;text-align:center;
      background:var(--bg-overlay);border-radius:var(--radius-md);border:1.5px dashed var(--border-default);font-size:var(--text-sm);}
    .media-options{display:flex;justify-content:center;
      .view-once-toggle{display:flex;align-items:center;gap:6px;background:var(--input-bg);padding:7px 14px;
        border-radius:var(--radius-full);cursor:pointer;font-size:var(--text-xs);font-weight:600;
        transition:all var(--duration-base);border:1px solid transparent;&:hover{filter:brightness(1.05);}
        &.active{background:rgba(255,85,0,0.1);color:#ff5500;border-color:rgba(255,85,0,0.3);}}}
    .preview-actions{display:flex;gap:8px;
      input{flex:1;padding:10px 14px;border-radius:var(--radius-full);border:1px solid var(--border-default);
        background:var(--input-bg);color:var(--text-primary);outline:none;transition:all var(--duration-base);
        font-size:var(--text-sm);font-family:'Plus Jakarta Sans',sans-serif;&:focus{border-color:var(--msg-sent);}&:disabled{opacity:0.5;}}
      button{background:var(--aurora-gradient);border:none;border-radius:50%;min-width:42px;height:42px;
        display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;font-size:var(--text-lg);
        transition:all var(--duration-base);box-shadow:0 4px 16px rgba(124,58,237,0.35);
        &:hover:not(:disabled){filter:brightness(1.1);transform:scale(1.05);}
        &:disabled{background:var(--bg-overlay);cursor:not-allowed;box-shadow:none;color:var(--text-secondary);}}}
    .spin-icon{animation:fa-spin 1s infinite linear;}}
`;

const Wrapper = styled.div`
  display:flex;flex-direction:column;width:100%;position:relative;
  .status-badges{position:absolute;top:-36px;left:1.5rem;display:flex;gap:8px;z-index:10;
    .badge{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:var(--radius-full);
      font-size:var(--text-xs);font-weight:700;cursor:pointer;color:white;animation:${popIn} 0.3s var(--ease-spring);
      box-shadow:0 4px 12px rgba(0,0,0,0.2);
      .close{margin-left:4px;opacity:0.6;transition:opacity var(--duration-fast);&:hover{opacity:1;}}}
    .timer-badge{background:rgba(255,85,0,0.15);border:1px solid rgba(255,85,0,0.4);color:#ff5500;backdrop-filter:blur(8px);}
    .schedule-badge{background:rgba(34,211,165,0.12);border:1px solid rgba(34,211,165,0.3);color:var(--color-success);backdrop-filter:blur(8px);}}
  .reply-banner{background:var(--bg-overlay);padding:8px 1.5rem;display:flex;justify-content:space-between;align-items:center;
    color:var(--text-secondary);font-size:var(--text-xs);border-top:1px solid var(--border-subtle);
    .close-btn{cursor:pointer;color:var(--text-tertiary);font-size:var(--text-base);transition:all var(--duration-fast);
      padding:4px;border-radius:var(--radius-sm);&:hover{color:var(--color-danger);transform:scale(1.1);}}}
  .edit-banner{background:rgba(34,211,165,0.06);border-top:1px solid rgba(34,211,165,0.15);}
  .link-banner{background:rgba(96,165,250,0.06);border-top:1px solid rgba(96,165,250,0.15);justify-content:flex-start;animation:${popIn} 0.3s var(--ease-spring);}
  @keyframes fa-spin{to{transform:rotate(360deg);}}
`;

const Container = styled.div`
  display:flex;align-items:center;gap:clamp(10px,2vw,20px);
  background:var(--bg-surface);padding:10px clamp(1rem,2.5vw,1.75rem);min-height:68px;
  border-top:1px solid var(--border-subtle);
  ${({ $isRecording }) => $isRecording && css`background:rgba(239,68,68,0.04);border-top-color:rgba(239,68,68,0.2);`}
  @media(max-width:640px){padding:8px 1rem;gap:8px;}
  .button-container{display:flex;align-items:center;gap:clamp(6px,1.5vw,14px);flex-shrink:0;
    .tool-toggle{position:relative;cursor:pointer;
      svg{font-size:1.2rem;color:var(--text-secondary);transition:all var(--duration-fast) var(--ease-spring);
        &:hover{color:var(--text-primary);transform:scale(1.15) translateY(-2px);}}
      &.active svg{color:var(--msg-sent);filter:drop-shadow(0 0 6px rgba(124,58,237,0.5));}}
    .emoji svg{color:#eab308;}
    .upload svg{color:var(--color-info);}
    .mic .recording-active{color:var(--color-danger);animation:${pulse} 1s infinite;filter:drop-shadow(0 0 8px var(--color-danger));}
    .loading-mic{color:var(--text-secondary);animation:fa-spin 1s infinite linear;}
    .code-toggle.active svg{color:var(--accent-cyan);filter:drop-shadow(0 0 6px var(--accent-cyan));}
    .floating-menu{position:absolute;bottom:56px;left:0;background:var(--glass-noise),var(--bg-panel);
      backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:var(--glass-shadow);
      border:1px solid var(--glass-border);border-radius:var(--radius-lg);z-index:99;animation:${popIn} 0.25s var(--ease-spring);}
    .timer-menu,.schedule-menu{padding:1rem;width:210px;display:flex;flex-direction:column;gap:6px;
      h4{color:var(--text-primary);margin:0 0 8px;font-size:var(--text-xs);font-weight:800;text-align:center;
        text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;}
      button{background:var(--input-bg);border:1px solid transparent;color:var(--text-primary);font-size:var(--text-xs);
        font-weight:600;padding:8px;border-radius:var(--radius-sm);cursor:pointer;transition:all var(--duration-fast);
        font-family:'Plus Jakarta Sans',sans-serif;&:hover{background:var(--bg-hover);}
        &.selected{background:rgba(124,58,237,0.15);border-color:var(--msg-sent);color:var(--msg-sent);font-weight:800;}}
      input[type="datetime-local"]{background:var(--input-bg);color:var(--text-primary);font-size:var(--text-xs);
        border:1px solid var(--border-default);padding:8px 10px;border-radius:var(--radius-sm);outline:none;
        font-family:'Plus Jakarta Sans',sans-serif;margin-bottom:4px;&:focus{border-color:var(--msg-sent);}}}}
  .input-container{flex:1;border-radius:var(--radius-xl);display:flex;align-items:flex-end;gap:8px;
    background:var(--input-bg);padding:6px 6px 6px 4px;border:1px solid var(--border-subtle);transition:all var(--duration-base);
    &:focus-within{border-color:var(--msg-sent);background:rgba(124,58,237,0.04);box-shadow:0 0 0 3px rgba(124,58,237,0.1);}
    .recording-ui{flex:1;height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;
      .rec-text{color:var(--color-danger);font-style:italic;font-weight:700;font-size:var(--text-xs);animation:${pulse} 1.5s infinite;}
      .dynamic-waveform{display:flex;align-items:center;gap:3px;height:28px;
        .bar{width:3px;background:var(--color-danger);border-radius:3px;transition:height 0.05s ease;min-height:3px;}}}
    textarea{flex:1;background:transparent;color:var(--text-primary);border:none;padding:8px 8px 8px 12px;
      font-size:var(--text-sm);resize:none;overflow-y:auto;line-height:1.5;font-family:'Plus Jakarta Sans',sans-serif;
      max-height:160px;min-height:36px;
      &::-webkit-scrollbar{width:3px;}&::-webkit-scrollbar-thumb{background:var(--border-default);border-radius:99px;}
      &::placeholder{color:var(--text-tertiary);}&:focus{outline:none;}&:disabled{opacity:0.5;cursor:not-allowed;}}
    button{padding:8px;border-radius:50%;min-width:38px;height:38px;display:flex;justify-content:center;align-items:center;
      border:none;transition:all var(--duration-base);flex-shrink:0;
      &.empty{background:var(--bg-overlay);color:var(--text-tertiary);cursor:default;}
      &.ready{background:var(--aurora-gradient);color:white;cursor:pointer;box-shadow:0 4px 16px rgba(124,58,237,0.35);
        &:hover{transform:scale(1.08);box-shadow:0 8px 24px rgba(124,58,237,0.5);}}
      svg{font-size:1.1rem;}&:disabled{background:var(--bg-overlay);cursor:not-allowed;box-shadow:none;color:var(--text-tertiary);}
      &.schedule-btn{background:linear-gradient(135deg,var(--color-success),#059669);box-shadow:0 4px 14px rgba(34,211,165,0.3);color:white;}
      .spin-icon{animation:fa-spin 1s infinite linear;}}}
`;