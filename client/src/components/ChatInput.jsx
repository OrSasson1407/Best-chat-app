import React, { useState, useRef, useEffect, Suspense, lazy } from "react";
import styled, { keyframes, css } from "styled-components";
import axios from "axios"; 
import { IoMdSend, IoMdClose, IoMdCheckmark } from "react-icons/io";
import { 
    BsEmojiSmileFill, BsPaperclip, BsMicFill, 
    BsStopCircleFill, BsCodeSlash, BsClockHistory, BsTerminal 
} from "react-icons/bs";
import { FaBomb, FaFire, FaCalendarAlt, FaLink, FaSpinner, FaLock, FaMagic } from "react-icons/fa";
import { toast } from "react-toastify"; 

// --- TRIPLE HANDSHAKE MERGE: IMPORT UUID ---
import { v4 as uuidv4 } from 'uuid';

// --- MERGE UPDATE: IMPORT ZUSTAND STORE ---
import useChatStore from "../store/chatStore";

// --- NEW: Import the Haptic Engine ---
import { triggerHaptic } from "../utils/haptics";

// 🚀 PERFORMANCE FIX: Dynamically import the heavy Emoji Picker only when needed
const EmojiPicker = lazy(() => import("emoji-picker-react"));

// SECURITY FIX: Cloudinary credentials were hard-coded in source, allowing anyone to
// upload unlimited files to the account using the public unsigned preset.
// Moved to Vite env vars — add VITE_CLOUDINARY_CLOUD_NAME and
// VITE_CLOUDINARY_UPLOAD_PRESET to client/.env (never commit that file).
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// --- COMMANDS REGISTRY ---
const COMMANDS = [
    { cmd: "/code", desc: "Enable Code Mode", icon: <BsCodeSlash /> },
    { cmd: "/bomb", desc: "Set 1-hour self-destruct", icon: <FaBomb /> },
    { cmd: "/clear", desc: "Clear current input", icon: <FaMagic /> },
];

export default function ChatInput({ 
    handleSendMsg, handleTyping, replyingTo, setReplyingTo, 
    editingMessage, setEditingMessage, handleEditMsgSubmit,
    droppedFile, onClearDrop
}) {
  
  const { currentChat, currentUser, theme } = useChatStore();

  const [msg, setMsg] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null); 
  
  const [isUploading, setIsUploading] = useState(false);
  
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [timerDuration, setTimerDuration] = useState(null); 
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [isViewOnceMedia, setIsViewOnceMedia] = useState(false);
  
  const [detectedUrl, setDetectedUrl] = useState(null);

  const [showCommands, setShowCommands] = useState(false);
  const [audioLevels, setAudioLevels] = useState(Array(15).fill(10));
  
  const streamRef = useRef(null);
  const textareaRef = useRef(null); 
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);
  const animationFrameRef = useRef(null);

  const isChannel = currentChat?.isChannel || false;
  const isAdmin = currentChat?.admins?.includes(currentUser?._id);
  const isMod = currentChat?.moderators?.includes(currentUser?._id);
  const canPost = !isChannel || isAdmin || isMod;

  const hasContent = msg.trim().length > 0 || mediaPreview !== null;

  useEffect(() => {
      if (droppedFile && canPost) {
          processFile(droppedFile);
          if (onClearDrop) onClearDrop();
      }
  }, [droppedFile, canPost, onClearDrop]);

  useEffect(() => {
      if (editingMessage) {
          setMsg(editingMessage.text);
          setReplyingTo(null); 
          if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
          }
      }
  }, [editingMessage, setReplyingTo]);

  useEffect(() => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = msg.match(urlRegex);
      if (match && match.length > 0) {
          setDetectedUrl(match[0]);
      } else {
          setDetectedUrl(null);
      }
  }, [msg]);

  useEffect(() => {
      const handleClickOutside = (e) => {
          if (!e.target.closest('.button-container')) {
              setShowEmojiPicker(false);
              setShowTimerMenu(false);
              setShowScheduleMenu(false);
          }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
      return () => {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
              audioContextRef.current.close().catch(()=>console.log("Audio context already closed"));
          }
          // BUGFIX: Release microphone on unmount in case the component disappears mid-recording
          if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
              streamRef.current = null;
          }
      }
  }, []);

  const handleEmojiClick = (emojiData) => {
    triggerHaptic('light'); // Subtle tactile feedback for emoji selection
    setMsg((prev) => prev + emojiData.emoji);
    handleTyping(true); 
  };

  const resetTextarea = () => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
      }
  };

  const executeCommand = (cmdStr) => {
      triggerHaptic('success'); // Haptic confirmation of command execution
      if (cmdStr === "/code") setIsCodeMode(true);
      if (cmdStr === "/bomb") setTimerDuration(3600);
      if (cmdStr === "/clear") { setMsg(""); setIsCodeMode(false); setTimerDuration(null); }
      setShowCommands(false);
      setMsg("");
      resetTextarea();
  };

  const sendChat = (event) => {
    event?.preventDefault();

    if (mediaPreview && canPost && !isUploading) {
        confirmSendMedia();
        return;
    }

    if (hasContent && canPost && !isUploading) {
      if (editingMessage) {
          handleEditMsgSubmit(editingMessage.id, msg);
          setEditingMessage(null);
      } else {
          const localId = uuidv4();
          handleSendMsg(msg, isCodeMode ? "code" : (detectedUrl ? "link" : "text"), replyingTo?.id, {
              timer: timerDuration,
              scheduledAt: scheduleDate || null,
              localId 
          }); 
      }
      setMsg("");
      resetTextarea();
      setIsCodeMode(false);
      setReplyingTo(null);
      handleTyping(false);
      setShowEmojiPicker(false);
      setScheduleDate(""); 
      setShowScheduleMenu(false);
      setDetectedUrl(null);
      setShowCommands(false); 
    }
  };

  const handleInput = (e) => {
      const val = e.target.value;
      setMsg(val);
      handleTyping(val.length > 0);
      
      if (val.startsWith("/")) setShowCommands(true);
      else setShowCommands(false);

      e.target.style.height = 'auto';
      const newHeight = Math.min(e.target.scrollHeight, 150); 
      e.target.style.height = `${newHeight}px`;
  };

  const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault(); 
          if (showCommands && COMMANDS.some(c => msg.startsWith(c.cmd))) {
              executeCommand(msg.trim());
          } else {
              sendChat();
          }
      }
  };

  const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      let type = "file";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("video/")) type = "video";

      triggerHaptic('medium'); // Tactile feedback on file load
      setMediaPreview({ 
          src: reader.result, 
          type, 
          rawFile: file,
          fileName: file.name,
          fileSize: formatFileSize(file.size)
      }); 
      setIsViewOnceMedia(false); 
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
      if (e.clipboardData.files && e.clipboardData.files.length > 0 && canPost) {
          e.preventDefault();
          const file = e.clipboardData.files[0];
          processFile(file);
      }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && canPost) {
      processFile(file);
    }
    e.target.value = null; 
  };

  const uploadToCloudinary = async (file, resourceType = "auto") => {
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
          console.error("[Media] Cloudinary env vars are not set. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to client/.env");
          return null;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      try {
          const response = await axios.post(
              `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, 
              formData,
              { withCredentials: false } 
          );
          return response.data.secure_url;
      } catch (error) {
          console.error("[Media] Cloudinary Upload Error:", error);
          return null;
      }
  };

  const confirmSendMedia = async () => {
      if (!mediaPreview || !mediaPreview.rawFile || !canPost) return;

      setIsUploading(true);
      
      let resType = "auto";
      let fileToUpload = mediaPreview.rawFile;

      if (mediaPreview.type === "video") {
          resType = "video";
      } else if (mediaPreview.type === "image") {
          resType = "image";
          try {
              // 🚀 PERFORMANCE FIX: Dynamically import image compression ONLY when an image is about to be sent
              const imageCompression = (await import("browser-image-compression")).default;
              const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
              fileToUpload = await imageCompression(mediaPreview.rawFile, options);
          } catch (error) {
              console.error("[Media] Image compression error, falling back to original:", error);
          }
      } else {
          resType = "raw"; 
      }

      const cloudUrl = await uploadToCloudinary(fileToUpload, resType);
      setIsUploading(false);

      if (cloudUrl) {
          const localId = uuidv4();
          handleSendMsg(cloudUrl, mediaPreview.type, replyingTo?.id, {
              isViewOnce: isViewOnceMedia,
              fileName: mediaPreview.fileName,
              fileSize: formatFileSize(fileToUpload.size),
              localId 
          });
          
          // BUGFIX: Previously setReplyingTo(null) was called here, BEFORE the
          // setTimeout that fires the caption text. That meant the follow-up text
          // message always lost its reply context. Capture the current replyingTo
          // value first, then clear state, then pass the captured value to sendChat.
          const pendingReply = replyingTo;
          setMediaPreview(null);
          setReplyingTo(null);
          
          if (msg.trim().length > 0) {
              // Pass the captured reply context directly instead of relying on state
              setTimeout(() => {
                  handleSendMsg(msg, "text", pendingReply?.id, {});
                  setMsg("");
                  resetTextarea();
              }, 200);
          }
      } else {
          toast.error("Media upload failed. Please try again.");
      }
  };

  const startRecording = async () => {
    if (!canPost) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // BUGFIX: Store the stream in a ref so we can stop all tracks on every exit path.
      // Previously, if the Cloudinary upload failed after recording, the MediaStream was
      // never stopped — the browser kept the microphone indicator active indefinitely.
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyzerRef.current);
      analyzerRef.current.fftSize = 64;
      const bufferLength = analyzerRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
          if (!analyzerRef.current) return;
          analyzerRef.current.getByteFrequencyData(dataArray);
          const step = Math.floor(bufferLength / 15);
          const newLevels = Array.from({length: 15}).map((_, i) => Math.max(10, dataArray[i * step] / 2));
          setAudioLevels(newLevels);
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(()=>console.log("Audio context already closed"));
        }
        // BUGFIX: Always stop all mic tracks when recording ends, success or failure.
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const audioFile = new File([audioBlob], `voice_record_${Date.now()}.mp3`, { type: "audio/mp3" });
        
        setIsUploading(true);
        const cloudUrl = await uploadToCloudinary(audioFile, "video"); 
        setIsUploading(false);

        if (cloudUrl) {
            const localId = uuidv4();
            handleSendMsg(cloudUrl, "audio", replyingTo?.id, { timer: timerDuration, localId }); 
            setReplyingTo(null);
        } else {
            toast.error("Failed to send audio message.");
        }
      };

      triggerHaptic('medium');
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      // BUGFIX: Also release any stream acquired before the error point.
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
      console.error("[Media] Error accessing microphone:", error);
      toast.warning("Microphone access denied. Please allow permissions in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      triggerHaptic('heavy'); // Satisfying hard tap when finishing a voice note
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleTimer = (duration) => {
      triggerHaptic('light');
      setTimerDuration(timerDuration === duration ? null : duration);
      setShowTimerMenu(false);
  };

  if (!canPost) {
      return (
          <Wrapper>
              <ReadOnlyBanner>
                  <FaLock className="lock-icon" />
                  <span>Only admins and moderators can send messages here.</span>
              </ReadOnlyBanner>
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

      {detectedUrl && !isRecording && !isCodeMode && (
         <div className="reply-banner link-banner">
             <FaLink style={{marginRight: '8px', color: '#34B7F1'}}/>
             <span>Link detected: A rich preview will be generated when sent.</span>
         </div>
      )}

      {replyingTo && !editingMessage && (
        <div className="reply-banner">
            <span>Replying to: <strong>{replyingTo.text.substring(0, 30)}...</strong></span>
            <IoMdClose onClick={() => { triggerHaptic('light'); setReplyingTo(null); }} className="close-btn" />
        </div>
      )}

      {editingMessage && (
        <div className="reply-banner edit-banner">
            <span>Editing message...</span>
            <IoMdClose onClick={() => { triggerHaptic('light'); setEditingMessage(null); setMsg(""); resetTextarea(); }} className="close-btn" />
        </div>
      )}

      {mediaPreview && (
          <PreviewOverlay>
              <div className="preview-container">
                  <div className="preview-header">
                      <span>Preview {mediaPreview.type}</span>
                      {!isUploading && <IoMdClose onClick={() => { triggerHaptic('light'); setMediaPreview(null); }} className="close-btn" />}
                  </div>
                  
                  {mediaPreview.type === "image" && <img src={mediaPreview.src} alt="Preview" />}
                  {mediaPreview.type === "video" && <video src={mediaPreview.src} controls />}
                  {mediaPreview.type === "file" && (
                    <div className="file-preview-icon">
                        📄 {mediaPreview.fileName} <br/> ({mediaPreview.fileSize})
                    </div>
                  )}

                  <div className="media-options">
                      <label className={`view-once-toggle ${isViewOnceMedia ? 'active' : ''}`}>
                          <input id="view-once" name="view-once" type="checkbox" disabled={isUploading} checked={isViewOnceMedia} onChange={(e) => { triggerHaptic('light'); setIsViewOnceMedia(e.target.checked); }} hidden />
                          <FaFire /> {isViewOnceMedia ? "View Once Enabled" : "Send as View Once"}
                      </label>
                  </div>

                  <div className="preview-actions">
                      <input id="media-caption" name="media-caption" type="text" disabled={isUploading} placeholder="Add a caption..." value={msg} onChange={(e) => setMsg(e.target.value)} />
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
            <BsEmojiSmileFill onClick={(e) => { 
                e.stopPropagation(); 
                triggerHaptic('light');
                setShowEmojiPicker(!showEmojiPicker); 
                setShowTimerMenu(false); 
                setShowScheduleMenu(false); 
            }} />
            {showEmojiPicker && (
               <div className="floating-menu emoji-picker-react" onClick={e => e.stopPropagation()}>
                 <Suspense fallback={<div style={{padding: '1.5rem', color: 'var(--text-dim)', fontSize: 'var(--text-sm)'}}>Loading Emojis...</div>}>
                   <EmojiPicker theme={theme === 'light' ? 'light' : 'dark'} onEmojiClick={handleEmojiClick} />
                 </Suspense>
               </div>
            )}
          </div>

          <div className="upload tool-toggle" onClick={() => { if (!isUploading) { triggerHaptic('light'); fileInputRef.current.click(); } }} title="Attach File">
            <BsPaperclip />
            <input id="file-upload" name="file-upload" type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar" onChange={handleFileUpload} />
          </div>

          <div className="mic tool-toggle" onClick={isRecording ? stopRecording : startRecording} title="Record Audio">
            {isRecording ? <BsStopCircleFill className="recording-active" /> : (isUploading ? <FaSpinner className="spin-icon loading-mic" /> : <BsMicFill />)}
          </div>

          <div className={`tool-toggle ${timerDuration ? 'active' : ''}`} title="Self-Destruct Timer">
              <FaBomb onClick={(e) => { 
                  e.stopPropagation(); 
                  triggerHaptic('light');
                  setShowTimerMenu(!showTimerMenu); 
                  setShowEmojiPicker(false); 
                  setShowScheduleMenu(false); 
              }} />
              {showTimerMenu && (
                  <div className="floating-menu timer-menu" onClick={e => e.stopPropagation()}>
                      <h4>Self-Destruct</h4>
                      <button className={timerDuration === null ? 'selected' : ''} onClick={() => toggleTimer(null)}>Off</button>
                      <button className={timerDuration === 3600 ? 'selected' : ''} onClick={() => toggleTimer(3600)}>1 Hour</button>
                      <button className={timerDuration === 86400 ? 'selected' : ''} onClick={() => toggleTimer(86400)}>1 Day</button>
                      <button className={timerDuration === 604800 ? 'selected' : ''} onClick={() => toggleTimer(604800)}>1 Week</button>
                  </div>
              )}
          </div>

          <div className={`tool-toggle ${scheduleDate ? 'active' : ''}`} title="Schedule Message">
              <BsClockHistory onClick={(e) => { 
                  e.stopPropagation(); 
                  triggerHaptic('light');
                  setShowScheduleMenu(!showScheduleMenu); 
                  setShowEmojiPicker(false); 
                  setShowTimerMenu(false); 
              }} />
              {showScheduleMenu && (
                  <div className="floating-menu schedule-menu" onClick={e => e.stopPropagation()}>
                      <h4>Schedule Message</h4>
                      <input 
                        id="schedule-date"
                        name="schedule-date"
                        type="datetime-local" 
                        value={scheduleDate} 
                        onChange={(e) => setScheduleDate(e.target.value)} 
                        min={new Date().toISOString().slice(0, 16)}
                      />
                      <button onClick={() => { triggerHaptic('success'); setShowScheduleMenu(false); }}>Set Schedule</button>
                  </div>
              )}
          </div>

          <div className={`code-toggle tool-toggle ${isCodeMode ? 'active' : ''}`} onClick={() => { triggerHaptic('light'); setIsCodeMode(!isCodeMode); }} title="Send Code Snippet">
              <BsCodeSlash />
          </div>
        </div>

        <form className="input-container" onSubmit={(event) => sendChat(event)}>
          {isRecording ? (
            <div className="recording-ui">
               <span className="rec-text">Recording Audio... (Click Stop)</span>
               <div className="dynamic-waveform">
                   {audioLevels.map((level, i) => (
                       <span key={i} className="bar" style={{ height: `${level}px` }}></span>
                   ))}
               </div>
            </div>
          ) : isCodeMode ? (
            <textarea 
              placeholder="Paste your code snippet here..." 
              onChange={handleInput} 
              onKeyDown={handleKeyDown}
              value={msg} 
              onPaste={handlePaste} 
              rows="2" 
              disabled={isUploading}
            />
          ) : (
            <textarea
              ref={textareaRef}
              placeholder={isUploading ? "Uploading media..." : (showCommands ? "Select a command..." : "Type a message or use '/' for commands...")}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              value={msg}
              onPaste={handlePaste}
              onBlur={() => handleTyping(false)}
              disabled={isUploading}
              rows="1"
            />
          )}
          
          <button 
             type="submit" 
             className={`${scheduleDate ? 'schedule-btn' : ''} ${hasContent ? 'ready' : 'empty'}`} 
             disabled={isRecording || isUploading || (!hasContent && !mediaPreview)}
          >
            {isUploading ? <FaSpinner className="spin-icon" /> : (editingMessage ? <IoMdCheckmark /> : (scheduleDate ? <BsClockHistory /> : <IoMdSend />))}
          </button>
        </form>
      </Container>
    </Wrapper>
  );
}

// --- STYLES & ANIMATIONS ---

const popIn = keyframes`
  0% { transform: scale(0.9) translateY(10px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;

const ReadOnlyBanner = styled.div`
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-surface);
  color: var(--text-secondary);
  padding: 1rem 1.5rem; border-top: 1px solid var(--border-subtle);
  font-style: italic; font-size: var(--text-sm); min-height: 64px;
  gap: 8px;
  .lock-icon { font-size: var(--text-base); color: var(--msg-sent); }
`;

const CommandPalette = styled.div`
  position: absolute; bottom: 80px; left: 1.5rem; width: 280px;
  background: var(--glass-noise), var(--bg-panel);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border); border-radius: var(--radius-lg);
  overflow: hidden; box-shadow: var(--glass-shadow); z-index: 100;
  animation: ${popIn} 0.2s var(--ease-spring);

  .cmd-header {
    padding: 9px 14px; background: var(--bg-overlay);
    font-size: var(--text-2xs); font-weight: 800; color: var(--text-secondary);
    display: flex; align-items: center; gap: 7px;
    border-bottom: 1px solid var(--border-subtle);
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .cmd-item {
    display: flex; align-items: center; gap: 10px; padding: 11px 14px;
    cursor: pointer; transition: all var(--duration-fast); color: var(--text-primary);
    &:hover { background: var(--bg-hover); padding-left: 18px; }
  }

  .cmd-icon { color: var(--text-secondary); display: flex; align-items: center; font-size: var(--text-base); }
  .cmd-name { font-weight: 700; color: var(--msg-sent); font-size: var(--text-sm); }
  .cmd-desc { font-size: var(--text-xs); color: var(--text-secondary); }
`;

const PreviewOverlay = styled.div`
  position: absolute; bottom: 80px; left: 0; right: 0;
  display: flex; justify-content: center; z-index: 100;

  .preview-container {
    background: var(--glass-noise), var(--bg-panel);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-radius: var(--radius-xl); padding: 1.25rem;
    box-shadow: var(--glass-shadow); border: 1px solid var(--glass-border);
    display: flex; flex-direction: column; gap: 1rem;
    width: min(380px, 95vw);
    animation: ${popIn} 0.3s var(--ease-spring);
    color: var(--text-primary);

    .preview-header {
      display: flex; justify-content: space-between; align-items: center;
      font-weight: 700; font-size: var(--text-sm);
      .close-btn {
        cursor: pointer; font-size: var(--text-lg); color: var(--text-secondary);
        transition: all var(--duration-fast); padding: 4px; border-radius: var(--radius-sm);
        &:hover { color: var(--color-danger); transform: scale(1.1); }
      }
    }

    img, video { width: 100%; max-height: 240px; object-fit: contain; border-radius: var(--radius-md); background: var(--bg-overlay); }
    .file-preview-icon {
      height: 110px; display: flex; align-items: center; justify-content: center;
      text-align: center; background: var(--bg-overlay); border-radius: var(--radius-md);
      border: 1.5px dashed var(--border-default); font-size: var(--text-sm);
    }

    .media-options {
      display: flex; justify-content: center;
      .view-once-toggle {
        display: flex; align-items: center; gap: 6px;
        background: var(--input-bg); padding: 7px 14px;
        border-radius: var(--radius-full); cursor: pointer; font-size: var(--text-xs);
        font-weight: 600; transition: all var(--duration-base); border: 1px solid transparent;
        &:hover { filter: brightness(1.05); }
        &.active { background: rgba(255,85,0,0.1); color: #ff5500; border-color: rgba(255,85,0,0.3); }
      }
    }

    .preview-actions {
      display: flex; gap: 8px;
      input {
        flex: 1; padding: 10px 14px; border-radius: var(--radius-full);
        border: 1px solid var(--border-default); background: var(--input-bg);
        color: var(--text-primary); outline: none;
        transition: all var(--duration-base); font-size: var(--text-sm);
        font-family: 'Plus Jakarta Sans', sans-serif;
        &:focus { border-color: var(--msg-sent); }
        &:disabled { opacity: 0.5; }
      }
      button {
        background: var(--aurora-gradient); border: none; border-radius: 50%;
        min-width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: white; font-size: var(--text-lg);
        transition: all var(--duration-base); box-shadow: 0 4px 16px rgba(124,58,237,0.35);
        &:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.05); }
        &:disabled { background: var(--bg-overlay); cursor: not-allowed; box-shadow: none; color: var(--text-secondary); }
      }
      .spin-icon { animation: fa-spin 1s infinite linear; }
    }
  }
`;

const Wrapper = styled.div`
  display: flex; flex-direction: column; width: 100%; position: relative;

  .status-badges {
    position: absolute; top: -36px; left: 1.5rem; display: flex; gap: 8px; z-index: 10;
    .badge {
      display: flex; align-items: center; gap: 6px; padding: 5px 12px;
      border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 700;
      cursor: pointer; color: white; animation: ${popIn} 0.3s var(--ease-spring);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      .close { margin-left: 4px; opacity: 0.6; transition: opacity var(--duration-fast); &:hover { opacity: 1; } }
    }
    .timer-badge { background: rgba(255,85,0,0.15); border: 1px solid rgba(255,85,0,0.4); color: #ff5500; backdrop-filter: blur(8px); }
    .schedule-badge { background: rgba(34,211,165,0.12); border: 1px solid rgba(34,211,165,0.3); color: var(--color-success); backdrop-filter: blur(8px); }
  }

  .reply-banner {
    background: var(--bg-overlay); padding: 8px 1.5rem;
    display: flex; justify-content: space-between; align-items: center;
    color: var(--text-secondary); font-size: var(--text-xs);
    border-top: 1px solid var(--border-subtle);
    .close-btn {
      cursor: pointer; color: var(--text-tertiary); font-size: var(--text-base);
      transition: all var(--duration-fast); padding: 4px; border-radius: var(--radius-sm);
      &:hover { color: var(--color-danger); transform: scale(1.1); }
    }
  }
  .edit-banner { background: rgba(34,211,165,0.06); border-top: 1px solid rgba(34,211,165,0.15); }
  .link-banner { background: rgba(96,165,250,0.06); border-top: 1px solid rgba(96,165,250,0.15); justify-content: flex-start; animation: ${popIn} 0.3s var(--ease-spring); }

  @keyframes fa-spin { to { transform: rotate(360deg); } }
`;

const Container = styled.div`
  display: flex; align-items: center; gap: clamp(10px, 2vw, 20px);
  background: var(--bg-surface);
  padding: 10px clamp(1rem, 2.5vw, 1.75rem);
  min-height: 68px;
  border-top: 1px solid var(--border-subtle);

  ${({ $isRecording }) => $isRecording && css`
    background: rgba(239,68,68,0.04);
    border-top-color: rgba(239,68,68,0.2);
  `}

  @media (max-width: 640px) { padding: 8px 1rem; gap: 8px; }

  .button-container {
    display: flex; align-items: center; gap: clamp(6px, 1.5vw, 14px); flex-shrink: 0;

    .tool-toggle {
      position: relative; cursor: pointer;
      svg {
        font-size: 1.2rem; color: var(--text-secondary);
        transition: all var(--duration-fast) var(--ease-spring);
        &:hover { color: var(--text-primary); transform: scale(1.15) translateY(-2px); }
      }
      &.active svg { color: var(--msg-sent); filter: drop-shadow(0 0 6px rgba(124,58,237,0.5)); }
    }

    .emoji svg { color: #eab308; }
    .upload svg { color: var(--color-info); }
    .mic .recording-active { color: var(--color-danger); animation: ${pulse} 1s infinite; filter: drop-shadow(0 0 8px var(--color-danger)); }
    .loading-mic { color: var(--text-secondary); animation: fa-spin 1s infinite linear; }
    .code-toggle.active svg { color: var(--accent-cyan); filter: drop-shadow(0 0 6px var(--accent-cyan)); }

    .floating-menu {
      position: absolute; bottom: 56px; left: 0;
      background: var(--glass-noise), var(--bg-panel);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      box-shadow: var(--glass-shadow); border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg); z-index: 99;
      animation: ${popIn} 0.25s var(--ease-spring);
    }

    .timer-menu, .schedule-menu {
      padding: 1rem; width: 210px; display: flex; flex-direction: column; gap: 6px;
      h4 {
        color: var(--text-primary); margin: 0 0 8px; font-size: var(--text-xs);
        font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.4px;
        border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;
      }
      button {
        background: var(--input-bg); border: 1px solid transparent; color: var(--text-primary);
        font-size: var(--text-xs); font-weight: 600; padding: 8px; border-radius: var(--radius-sm);
        cursor: pointer; transition: all var(--duration-fast); font-family: 'Plus Jakarta Sans', sans-serif;
        &:hover { background: var(--bg-hover); }
        &.selected { background: rgba(124,58,237,0.15); border-color: var(--msg-sent); color: var(--msg-sent); font-weight: 800; }
      }
      input[type="datetime-local"] {
        background: var(--input-bg); color: var(--text-primary); font-size: var(--text-xs);
        border: 1px solid var(--border-default); padding: 8px 10px;
        border-radius: var(--radius-sm); outline: none; font-family: 'Plus Jakarta Sans', sans-serif;
        margin-bottom: 4px;
        &:focus { border-color: var(--msg-sent); }
      }
    }
  }

  .input-container {
    flex: 1; border-radius: var(--radius-xl); display: flex; align-items: flex-end; gap: 8px;
    background: var(--input-bg); padding: 6px 6px 6px 4px;
    border: 1px solid var(--border-subtle);
    transition: all var(--duration-base);

    &:focus-within {
      border-color: var(--msg-sent); background: rgba(124,58,237,0.04);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
    }

    .recording-ui {
      flex: 1; height: 40px; display: flex; align-items: center;
      justify-content: space-between; padding: 0 12px;
      .rec-text {
        color: var(--color-danger); font-style: italic; font-weight: 700;
        font-size: var(--text-xs); animation: ${pulse} 1.5s infinite;
      }
      .dynamic-waveform {
        display: flex; align-items: center; gap: 3px; height: 28px;
        .bar { width: 3px; background: var(--color-danger); border-radius: 3px; transition: height 0.05s ease; min-height: 3px; }
      }
    }

    textarea {
      flex: 1; background: transparent; color: var(--text-primary);
      border: none; padding: 8px 8px 8px 12px;
      font-size: var(--text-sm); resize: none; overflow-y: auto;
      line-height: 1.5; font-family: 'Plus Jakarta Sans', sans-serif;
      max-height: 160px; min-height: 36px;
      &::-webkit-scrollbar { width: 3px; }
      &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }
      &::placeholder { color: var(--text-tertiary); }
      &:focus { outline: none; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    button {
      padding: 8px; border-radius: 50%; min-width: 38px; height: 38px;
      display: flex; justify-content: center; align-items: center;
      border: none; transition: all var(--duration-base); flex-shrink: 0;

      &.empty { background: var(--bg-overlay); color: var(--text-tertiary); cursor: default; }
      &.ready {
        background: var(--aurora-gradient); color: white; cursor: pointer;
        box-shadow: 0 4px 16px rgba(124,58,237,0.35);
        &:hover { transform: scale(1.08); box-shadow: 0 8px 24px rgba(124,58,237,0.5); }
      }
      svg { font-size: 1.1rem; }
      &:disabled { background: var(--bg-overlay); cursor: not-allowed; box-shadow: none; color: var(--text-tertiary); }
      &.schedule-btn {
        background: linear-gradient(135deg, var(--color-success), #059669);
        box-shadow: 0 4px 14px rgba(34,211,165,0.3); color: white;
      }
      .spin-icon { animation: fa-spin 1s infinite linear; }
    }
  }
`;