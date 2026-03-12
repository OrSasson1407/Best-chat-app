import React, { useState, useRef, useEffect } from "react";
import styled, { keyframes, css } from "styled-components";
import EmojiPicker, { Theme } from "emoji-picker-react";
import axios from "axios"; 
import imageCompression from "browser-image-compression"; 
import { IoMdSend, IoMdClose, IoMdCheckmark } from "react-icons/io";
import { 
    BsEmojiSmileFill, BsPaperclip, BsMicFill, 
    BsStopCircleFill, BsCodeSlash, BsClockHistory, BsTerminal 
} from "react-icons/bs";
import { FaBomb, FaFire, FaCalendarAlt, FaLink, FaSpinner, FaLock, FaMagic } from "react-icons/fa";

// --- MERGE UPDATE: IMPORT ZUSTAND STORE ---
import useChatStore from "../store/chatStore";

// --- CLOUDINARY CONFIGURATION ---
const CLOUDINARY_CLOUD_NAME = "dz6weueae"; 
const CLOUDINARY_UPLOAD_PRESET = "chat_app_preset"; // MUST be an "Unsigned" preset in Cloudinary settings

// --- COMMANDS REGISTRY ---
const COMMANDS = [
    { cmd: "/code", desc: "Enable Code Mode", icon: <BsCodeSlash /> },
    { cmd: "/bomb", desc: "Set 1-hour self-destruct", icon: <FaBomb /> },
    { cmd: "/clear", desc: "Clear current input", icon: <FaMagic /> },
];

export default function ChatInput({ 
    handleSendMsg, handleTyping, replyingTo, setReplyingTo, 
    editingMessage, setEditingMessage, handleEditMsgSubmit,
    droppedFile, onClearDrop // <-- NEW: Props for Drag-and-Drop handling
}) {
  
  // --- MERGE UPDATE: GET THEME & CURRENT CHAT ---
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

  // --- NEW: Slash Commands & Audio Analyzer State ---
  const [showCommands, setShowCommands] = useState(false);
  const [audioLevels, setAudioLevels] = useState(Array(15).fill(10));
  
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null); 
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- NEW: Audio Context Refs ---
  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);
  const animationFrameRef = useRef(null);

  const isChannel = currentChat?.isChannel || false;
  const isAdmin = currentChat?.admins?.includes(currentUser?._id);
  const isMod = currentChat?.moderators?.includes(currentUser?._id);
  const canPost = !isChannel || isAdmin || isMod;

  // Has content check for styling the Send button
  const hasContent = msg.trim().length > 0 || mediaPreview !== null;

  // Process file dropped from ChatContainer
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

  // Click outside listener to close menus
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

  // --- NEW: Clean up Audio Context on unmount ---
  useEffect(() => {
      return () => {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
              audioContextRef.current.close().catch(()=>console.log("Audio context already closed"));
          }
      }
  }, []);

  const handleEmojiClick = (emojiData) => {
    setMsg((prev) => prev + emojiData.emoji);
    handleTyping(true); 
  };

  const resetTextarea = () => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
      }
  };

  // --- NEW: Execute Slash Command ---
  const executeCommand = (cmdStr) => {
      if (cmdStr === "/code") setIsCodeMode(true);
      if (cmdStr === "/bomb") setTimerDuration(3600);
      if (cmdStr === "/clear") { setMsg(""); setIsCodeMode(false); setTimerDuration(null); }
      setShowCommands(false);
      setMsg("");
      resetTextarea();
  };

  const sendChat = (event) => {
    event?.preventDefault();
    if (hasContent && canPost && !isUploading) {
      if (editingMessage) {
          handleEditMsgSubmit(editingMessage.id, msg);
          setEditingMessage(null);
      } else {
          handleSendMsg(msg, isCodeMode ? "code" : (detectedUrl ? "link" : "text"), replyingTo?.id, {
              timer: timerDuration,
              scheduledAt: scheduleDate || null
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
      setShowCommands(false); // Close command palette if open
    }
  };

  const handleInput = (e) => {
      const val = e.target.value;
      setMsg(val);
      handleTyping(val.length > 0);
      
      // --- NEW: Trigger Slash Commands ---
      if (val.startsWith("/")) setShowCommands(true);
      else setShowCommands(false);

      // Auto-expand logic
      e.target.style.height = 'auto';
      const newHeight = Math.min(e.target.scrollHeight, 150); // Max height 150px
      e.target.style.height = `${newHeight}px`;
  };

  const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault(); // Prevent new line
          
          // --- NEW: Intercept Enter for Commands ---
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      try {
          const response = await axios.post(
              `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, 
              formData
          );
          return response.data.secure_url;
      } catch (error) {
          console.error("Cloudinary Upload Error:", error);
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
              const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
              fileToUpload = await imageCompression(mediaPreview.rawFile, options);
          } catch (error) {
              console.error("Image compression error, falling back to original:", error);
          }
      } else {
          resType = "raw"; 
      }

      const cloudUrl = await uploadToCloudinary(fileToUpload, resType);
      setIsUploading(false);

      if (cloudUrl) {
          handleSendMsg(cloudUrl, mediaPreview.type, replyingTo?.id, {
              isViewOnce: isViewOnceMedia,
              fileName: mediaPreview.fileName,
              fileSize: formatFileSize(fileToUpload.size) 
          });
          
          setMediaPreview(null);
          setReplyingTo(null);
          
          if (msg.trim().length > 0) {
              setTimeout(() => sendChat(), 200); 
          }
      } else {
          alert("Failed to upload media. Please ensure you created the 'chat_app_preset' Unsigned Preset in Cloudinary.");
      }
  };

  // --- MERGE UPDATE: Advanced Web Audio API Recording ---
  const startRecording = async () => {
    if (!canPost) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up Audio Analyzer
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
          // Sample 15 points across the frequency array for visualization
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
        // Stop animation
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(()=>console.log("Audio context already closed"));
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const audioFile = new File([audioBlob], `voice_record_${Date.now()}.mp3`, { type: "audio/mp3" });
        
        setIsUploading(true);
        const cloudUrl = await uploadToCloudinary(audioFile, "video"); 
        setIsUploading(false);

        if (cloudUrl) {
            handleSendMsg(cloudUrl, "audio", replyingTo?.id, { timer: timerDuration }); 
            setReplyingTo(null);
        } else {
            alert("Failed to upload audio message.");
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Microphone access denied. Please allow permissions in your browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleTimer = (duration) => {
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

  const emojiTheme = theme === 'light' ? Theme.LIGHT : Theme.DARK;

  return (
    <Wrapper>
      
      {/* --- NEW: Slash Command Palette --- */}
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
            <IoMdClose onClick={() => setReplyingTo(null)} className="close-btn" />
        </div>
      )}

      {editingMessage && (
        <div className="reply-banner edit-banner">
            <span>Editing message...</span>
            <IoMdClose onClick={() => { setEditingMessage(null); setMsg(""); resetTextarea(); }} className="close-btn" />
        </div>
      )}

      {mediaPreview && (
          <PreviewOverlay>
              <div className="preview-container">
                  <div className="preview-header">
                      <span>Preview {mediaPreview.type}</span>
                      {!isUploading && <IoMdClose onClick={() => setMediaPreview(null)} className="close-btn" />}
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
                          <input type="checkbox" disabled={isUploading} checked={isViewOnceMedia} onChange={(e) => setIsViewOnceMedia(e.target.checked)} hidden />
                          <FaFire /> {isViewOnceMedia ? "View Once Enabled" : "Send as View Once"}
                      </label>
                  </div>

                  <div className="preview-actions">
                      <input type="text" disabled={isUploading} placeholder="Add a caption..." value={msg} onChange={(e) => setMsg(e.target.value)} />
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
            <BsEmojiSmileFill onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); setShowTimerMenu(false); setShowScheduleMenu(false); }} />
            {showEmojiPicker && (
               <div className="floating-menu emoji-picker-react" onClick={e => e.stopPropagation()}>
                 <EmojiPicker theme={emojiTheme} onEmojiClick={handleEmojiClick} />
               </div>
            )}
          </div>

          <div className="upload tool-toggle" onClick={() => !isUploading && fileInputRef.current.click()} title="Attach File">
            <BsPaperclip />
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar" onChange={handleFileUpload} />
          </div>

          <div className="mic tool-toggle" onClick={isRecording ? stopRecording : startRecording} title="Record Audio">
            {isRecording ? <BsStopCircleFill className="recording-active" /> : (isUploading ? <FaSpinner className="spin-icon loading-mic" /> : <BsMicFill />)}
          </div>

          <div className={`tool-toggle ${timerDuration ? 'active' : ''}`} title="Self-Destruct Timer">
              <FaBomb onClick={(e) => { e.stopPropagation(); setShowTimerMenu(!showTimerMenu); setShowEmojiPicker(false); setShowScheduleMenu(false); }} />
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
              <BsClockHistory onClick={(e) => { e.stopPropagation(); setShowScheduleMenu(!showScheduleMenu); setShowEmojiPicker(false); setShowTimerMenu(false); }} />
              {showScheduleMenu && (
                  <div className="floating-menu schedule-menu" onClick={e => e.stopPropagation()}>
                      <h4>Schedule Message</h4>
                      <input 
                        type="datetime-local" 
                        value={scheduleDate} 
                        onChange={(e) => setScheduleDate(e.target.value)} 
                        min={new Date().toISOString().slice(0, 16)}
                      />
                      <button onClick={() => setShowScheduleMenu(false)}>Set Schedule</button>
                  </div>
              )}
          </div>

          <div className={`code-toggle tool-toggle ${isCodeMode ? 'active' : ''}`} onClick={() => setIsCodeMode(!isCodeMode)} title="Send Code Snippet">
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

// Only used as fallback now, dynamic waveform uses JS heights
const wave = keyframes`
  0%, 100% { height: 8px; }
  50% { height: 24px; }
`;

const ReadOnlyBanner = styled.div`
  display: flex; align-items: center; justify-content: center;
  background: var(--glass-bg);
  color: var(--text-dim);
  padding: 1.2rem; border-top: 1px solid var(--glass-border);
  font-style: italic; font-size: 0.95rem; min-height: 10%;
  
  .lock-icon { margin-right: 10px; font-size: 1.1rem; color: var(--msg-sent); }
`;

const CommandPalette = styled.div`
    position: absolute; bottom: 85px; left: 2rem; width: 300px;
    background: rgba(10, 10, 15, 0.85); backdrop-filter: blur(25px); 
    border: 1px solid var(--glass-border); border-radius: 12px; overflow: hidden; 
    box-shadow: 0 10px 40px rgba(0,0,0,0.4); z-index: 100; 
    animation: ${popIn} 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    
    .cmd-header { 
        padding: 10px 14px; background: rgba(255,255,255,0.05); font-size: 0.8rem; 
        font-weight: bold; color: var(--text-dim); display: flex; align-items: center; 
        gap: 8px; border-bottom: 1px solid var(--glass-border); text-transform: uppercase;
    }
    
    .cmd-item { 
        display: flex; align-items: center; gap: 12px; padding: 12px 14px; 
        cursor: pointer; transition: all 0.2s; color: var(--text-main);
        &:hover { background: var(--input-bg); transform: translateX(4px); } 
    }
    
    .cmd-icon { color: var(--text-dim); display: flex; align-items: center; }
    .cmd-name { font-weight: 700; color: #00ff88; }
    .cmd-desc { font-size: 0.8rem; opacity: 0.7; }
`;

const PreviewOverlay = styled.div`
    position: absolute; bottom: 85px; left: 0; right: 0;
    display: flex; justify-content: center; z-index: 100;
    
    .preview-container {
        background: var(--bg-panel); 
        backdrop-filter: blur(15px); border-radius: 1.5rem; padding: 1.2rem;
        box-shadow: 0 15px 40px rgba(0,0,0,0.4);
        border: 1px solid var(--glass-border);
        display: flex; flex-direction: column; gap: 1rem; width: 380px; 
        animation: ${popIn} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        color: var(--text-main);
        
        .preview-header {
            display: flex; justify-content: space-between; font-weight: bold;
            .close-btn { cursor: pointer; font-size: 1.5rem; transition: 0.2s; color: var(--text-dim); &:hover { color: #ff4e4e; transform: scale(1.1); } }
        }

        img, video { width: 100%; max-height: 250px; object-fit: contain; border-radius: 0.8rem; background: var(--input-bg); }
        .file-preview-icon { height: 120px; display: flex; align-items: center; justify-content: center; text-align: center; background: var(--input-bg); border-radius: 0.8rem; border: 2px dashed var(--glass-border); }

        .media-options {
            display: flex; justify-content: center;
            .view-once-toggle {
                display: flex; align-items: center; gap: 0.5rem; background: var(--input-bg);
                padding: 0.5rem 1rem; border-radius: 2rem; cursor: pointer; font-size: 0.85rem;
                transition: 0.3s; border: 1px solid transparent;
                &:hover { filter: brightness(1.1); }
                &.active { background: rgba(255, 85, 0, 0.1); color: #ff5500; border-color: #ff5500; font-weight: bold; }
                input:disabled + svg { opacity: 0.5; }
            }
        }

        .preview-actions {
            display: flex; gap: 0.8rem;
            input { flex: 1; padding: 0.9rem 1.2rem; border-radius: 2rem; border: 1px solid var(--glass-border); background: transparent; color: inherit; outline: none; transition: 0.3s; &:focus { border-color: var(--msg-sent); } &:disabled { opacity: 0.5; } }
            button { background: var(--msg-sent); border: none; border-radius: 50%; min-width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; font-size: 1.2rem; transition: 0.3s; &:hover:not(:disabled) { filter: brightness(1.2); transform: scale(1.05); } &:disabled { background: var(--text-dim); cursor: not-allowed; } }
            .spin-icon { animation: fa-spin 1s infinite linear; }
        }
    }
`;

const Wrapper = styled.div`
  display: flex; flex-direction: column; width: 100%; position: relative; 
  
  .status-badges {
      position: absolute; top: -35px; left: 2rem; display: flex; gap: 0.8rem; z-index: 10;
      .badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; border-radius: 1rem; font-size: 0.75rem; font-weight: bold; cursor: pointer; color: white; animation: ${popIn} 0.3s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.2); .close { margin-left: 5px; opacity: 0.6; &:hover { opacity: 1; } } }
      .timer-badge { background: rgba(255, 85, 0, 0.2); border: 1px solid #ff5500; color: #ff5500; backdrop-filter: blur(5px); }
      .schedule-badge { background: rgba(0, 255, 136, 0.2); border: 1px solid #00ff88; color: #00ff88; backdrop-filter: blur(5px); }
  }

  .reply-banner {
      background: var(--input-bg); backdrop-filter: blur(10px); padding: 0.6rem 2rem; display: flex; justify-content: space-between; align-items: center; color: var(--text-dim); font-size: 0.85rem; border-top: 1px solid var(--glass-border);
      .close-btn { cursor: pointer; color: var(--text-dim); font-size: 1.2rem; transition: 0.2s; &:hover { color: #ff4e4e; transform: scale(1.2); } }
  }
  .edit-banner { background: rgba(0, 255, 136, 0.15); }
  .link-banner { background: rgba(52, 183, 241, 0.1); border-top: 1px solid rgba(52, 183, 241, 0.2); justify-content: flex-start; animation: ${popIn} 0.3s ease; }
  
  @keyframes fa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const Container = styled.div`
  display: grid; grid-template-columns: 25% 75%; align-items: center;
  background-color: transparent; 
  padding: 0 2rem; min-height: 10%; 
  border-top: 1px solid var(--glass-border);
  
  ${({ $isRecording }) => $isRecording && css` background: rgba(255, 78, 78, 0.05); box-shadow: inset 0 0 20px rgba(255, 78, 78, 0.1); `}

  @media screen and (max-width: 1080px) { grid-template-columns: 35% 65%; }
  @media screen and (max-width: 720px) { padding: 0 1rem; gap: 1rem; grid-template-columns: 40% 60%; }
  
  .button-container {
    display: flex; align-items: center; gap: 1.2rem;
    
    .tool-toggle {
      position: relative; cursor: pointer;
      svg { font-size: 1.4rem; color: var(--text-dim); transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); &:hover { color: var(--text-main); transform: scale(1.15) translateY(-2px); } }
      &.active svg { color: var(--msg-sent); filter: drop-shadow(0 0 5px rgba(78,14,255,0.5)); }
    }
    
    .emoji svg { color: #d4d412; }
    .upload svg { color: #34B7F1; }
    .mic .recording-active { color: #ff4e4e; animation: ${pulse} 1s infinite; filter: drop-shadow(0 0 10px #ff4e4e); }
    .loading-mic { color: var(--text-dim); animation: fa-spin 1s infinite linear; }
    .code-toggle.active svg { color: #00ff88; filter: drop-shadow(0 0 5px #00ff88); }

    .floating-menu {
      position: absolute; bottom: 50px; left: 0; 
      background: var(--bg-panel); 
      backdrop-filter: blur(15px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3); 
      border: 1px solid var(--glass-border); 
      border-radius: 1rem; z-index: 99;
      animation: ${popIn} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .emoji-picker-react { border: none; background: transparent; .epr-body::-webkit-scrollbar { width: 4px; &-thumb { background-color: var(--msg-sent); border-radius: 10px; } } }

    .timer-menu, .schedule-menu {
        padding: 1.2rem; width: 220px; display: flex; flex-direction: column; gap: 0.6rem;
        h4 { color: var(--text-main); margin-top: 0; margin-bottom: 0.5rem; font-size: 0.9rem; text-align: center; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; }
        button { background: var(--input-bg); border: 1px solid transparent; color: inherit; padding: 0.6rem; border-radius: 0.5rem; cursor: pointer; transition: 0.2s; &:hover { filter: brightness(0.9); } &.selected { background: var(--msg-sent); color: white; font-weight: bold; box-shadow: 0 0 10px rgba(78,14,255,0.3); } }
        input[type="datetime-local"] { background: var(--input-bg); color: inherit; border: 1px solid var(--glass-border); padding: 0.8rem; border-radius: 0.5rem; outline: none; margin-bottom: 0.5rem; font-family: inherit; }
    }
  }

  .input-container {
    width: 100%; border-radius: 1.5rem; display: flex; align-items: flex-end; gap: 1rem;
    background-color: var(--input-bg); 
    padding: 0.5rem; transition: 0.3s;
    border: 1px solid transparent; 
    
    &:focus-within { 
        border-color: var(--msg-sent); box-shadow: 0 0 15px rgba(78, 14, 255, 0.1); 
    }
    
    .recording-ui {
        width: 100%; height: 40px; display: flex; align-items: center; justify-content: space-between; padding-left: 1.5rem; padding-right: 1rem;
        .rec-text { color: #ff4e4e; font-style: italic; font-weight: bold; animation: ${pulse} 1.5s infinite; }
        .dynamic-waveform { 
            display: flex; align-items: center; gap: 3px; height: 30px; 
            .bar { width: 4px; background: #ff4e4e; border-radius: 4px; transition: height 0.05s ease; min-height: 4px;} 
        }
    }

    textarea { 
        width: 100%; background-color: transparent; 
        color: var(--text-main); 
        border: none; padding-left: 1rem; padding-top: 0.6rem; padding-bottom: 0.6rem;
        font-size: 1rem; resize: none; overflow-y: auto; line-height: 1.4;
        font-family: inherit;
        &::-webkit-scrollbar { width: 4px; }
        &::-webkit-scrollbar-thumb { background-color: var(--glass-border); border-radius: 10px; }
        &::selection { background-color: var(--msg-sent); color: white;} 
        &:focus { outline: none; } 
        &:disabled { opacity: 0.5; cursor: not-allowed; } 
    }
    
    button {
      padding: 0.8rem; border-radius: 50%; display: flex; justify-content: center; align-items: center;
      border: none; transition: 0.3s; 
      
      &.empty { background: var(--bg-panel); color: var(--text-dim); cursor: default; }
      &.ready { background: var(--primary-gradient); color: white; cursor: pointer; box-shadow: 0 4px 15px rgba(78, 14, 255, 0.3); }
      &.ready:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(78, 14, 255, 0.5); }
      
      svg { font-size: 1.3rem; }
      &:disabled { background: var(--bg-panel); cursor: not-allowed; box-shadow: none; color: var(--text-dim); }
      &.schedule-btn { background: linear-gradient(135deg, #00ff88 0%, #00b35f 100%); box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3); color: black;}
      .spin-icon { animation: fa-spin 1s infinite linear; }
    }
  }
`;