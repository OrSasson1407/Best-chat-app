import React, { useState, useRef, useEffect } from "react";
import styled, { keyframes, css } from "styled-components";
import EmojiPicker, { Theme } from "emoji-picker-react";
import axios from "axios"; // <-- NEW: Imported axios for direct Cloudinary uploads
import { IoMdSend, IoMdClose, IoMdCheckmark } from "react-icons/io";
import { 
    BsEmojiSmileFill, BsPaperclip, BsMicFill, 
    BsStopCircleFill, BsCodeSlash, BsClockHistory 
} from "react-icons/bs";
import { FaBomb, FaFire, FaCalendarAlt, FaLink, FaSpinner } from "react-icons/fa"; // <-- NEW: Added FaSpinner

// --- CLOUDINARY CONFIGURATION ---
const CLOUDINARY_CLOUD_NAME = "dz6weueae"; 
const CLOUDINARY_UPLOAD_PRESET = "chat_app_preset"; // MUST be an "Unsigned" preset in Cloudinary settings

export default function ChatInput({ handleSendMsg, handleTyping, replyingTo, setReplyingTo, editingMessage, setEditingMessage, handleEditMsgSubmit }) {
  const [msg, setMsg] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null); 
  
  // --- NEW: UPLOADING STATE ---
  const [isUploading, setIsUploading] = useState(false);
  
  // --- STATE: PRODUCTIVITY & PRIVACY ---
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [timerDuration, setTimerDuration] = useState(null); 
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [isViewOnceMedia, setIsViewOnceMedia] = useState(false);
  
  // --- NEW: LINK DETECTION STATE ---
  const [detectedUrl, setDetectedUrl] = useState(null);
  
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
      if (editingMessage) {
          setMsg(editingMessage.text);
          setReplyingTo(null); 
      }
  }, [editingMessage, setReplyingTo]);

  // --- NEW: SMART LINK DETECTION ---
  useEffect(() => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = msg.match(urlRegex);
      if (match && match.length > 0) {
          setDetectedUrl(match[0]);
      } else {
          setDetectedUrl(null);
      }
  }, [msg]);

  const handleEmojiClick = (emojiData) => {
    setMsg((prev) => prev + emojiData.emoji);
    handleTyping(true); 
  };

  const sendChat = (event) => {
    event?.preventDefault();
    if (msg.length > 0) {
      if (editingMessage) {
          handleEditMsgSubmit(editingMessage.id, msg);
          setEditingMessage(null);
      } else {
          // Change type to 'link' if a URL is detected
          handleSendMsg(msg, isCodeMode ? "code" : (detectedUrl ? "link" : "text"), replyingTo?.id, {
              timer: timerDuration,
              scheduledAt: scheduleDate || null
          }); 
      }
      // Reset inputs
      setMsg("");
      setIsCodeMode(false);
      setReplyingTo(null);
      handleTyping(false);
      setShowEmojiPicker(false);
      setScheduleDate(""); 
      setShowScheduleMenu(false);
      setDetectedUrl(null);
    }
  };

  const handleChange = (e) => {
    setMsg(e.target.value);
    handleTyping(e.target.value.length > 0);
  };

  // --- MERGE UPDATE: FORMAT FILE SIZE HELPER ---
  const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // --- MERGE UPDATE: STORE ACTUAL FILE OBJECT & METADATA FOR CLOUD UPLOAD ---
  const processFile = (file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      let type = "file";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("video/")) type = "video";

      // Store BOTH the local preview string (reader.result) AND the raw file object + metadata
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

  // --- NEW: CLIPBOARD PASTE SUPPORT ---
  const handlePaste = (e) => {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          e.preventDefault();
          const file = e.clipboardData.files[0];
          processFile(file);
      }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
    e.target.value = null; 
  };

  // --- NEW: UPLOAD TO CLOUDINARY LOGIC ---
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

  // --- MERGE UPDATE: UPLOAD MEDIA & FILE METADATA BEFORE SENDING ---
  const confirmSendMedia = async () => {
      if (!mediaPreview || !mediaPreview.rawFile) return;

      setIsUploading(true);
      
      // Determine correct Cloudinary resource type
      let resType = "auto";
      if (mediaPreview.type === "video") resType = "video";
      else if (mediaPreview.type === "image") resType = "image";
      else resType = "raw"; // For documents like PDF, TXT

      const cloudUrl = await uploadToCloudinary(mediaPreview.rawFile, resType);

      setIsUploading(false);

      if (cloudUrl) {
          // --- MERGE UPDATE: Pass the file metadata directly to your handleSendMsg prop ---
          handleSendMsg(cloudUrl, mediaPreview.type, replyingTo?.id, {
              isViewOnce: isViewOnceMedia,
              fileName: mediaPreview.fileName,
              fileSize: mediaPreview.fileSize
          });
          
          setMediaPreview(null);
          setReplyingTo(null);
          
          if (msg.length > 0) {
              setTimeout(() => sendChat(), 200); 
          }
      } else {
          alert("Failed to upload media. Please ensure you created the 'chat_app_preset' Unsigned Preset in Cloudinary.");
      }
  };

  // --- MERGE UPDATE: UPLOAD AUDIO BEFORE SENDING ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const audioFile = new File([audioBlob], `voice_record_${Date.now()}.mp3`, { type: "audio/mp3" });
        
        setIsUploading(true);
        // Cloudinary treats audio uploads as "video" resource type natively
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

  return (
    <Wrapper>
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

      {/* --- NEW: LINK DETECTION BANNER --- */}
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
            <IoMdClose onClick={() => { setEditingMessage(null); setMsg(""); }} className="close-btn" />
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
                  {/* --- MERGE UPDATE: SHOW FILE NAME IN PREVIEW --- */}
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
          <div className="emoji">
            <BsEmojiSmileFill onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowTimerMenu(false); setShowScheduleMenu(false); }} />
            {showEmojiPicker && (
               <div className="floating-menu emoji-picker-react">
                 <EmojiPicker theme={Theme.DARK} onEmojiClick={handleEmojiClick} />
               </div>
            )}
          </div>

          <div className="upload" onClick={() => !isUploading && fileInputRef.current.click()} title="Attach File">
            <BsPaperclip />
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar" onChange={handleFileUpload} />
          </div>

          <div className="mic" onClick={isRecording ? stopRecording : startRecording} title="Record Audio">
            {isRecording ? <BsStopCircleFill className="recording-active" /> : (isUploading ? <FaSpinner className="spin-icon text-white" /> : <BsMicFill />)}
          </div>

          <div className={`tool-toggle ${timerDuration ? 'active' : ''}`} title="Self-Destruct Timer">
              <FaBomb onClick={() => { setShowTimerMenu(!showTimerMenu); setShowEmojiPicker(false); setShowScheduleMenu(false); }} />
              {showTimerMenu && (
                  <div className="floating-menu timer-menu">
                      <h4>Self-Destruct</h4>
                      <button className={timerDuration === null ? 'selected' : ''} onClick={() => toggleTimer(null)}>Off</button>
                      <button className={timerDuration === 3600 ? 'selected' : ''} onClick={() => toggleTimer(3600)}>1 Hour</button>
                      <button className={timerDuration === 86400 ? 'selected' : ''} onClick={() => toggleTimer(86400)}>1 Day</button>
                      <button className={timerDuration === 604800 ? 'selected' : ''} onClick={() => toggleTimer(604800)}>1 Week</button>
                  </div>
              )}
          </div>

          <div className={`tool-toggle ${scheduleDate ? 'active' : ''}`} title="Schedule Message">
              <BsClockHistory onClick={() => { setShowScheduleMenu(!showScheduleMenu); setShowEmojiPicker(false); setShowTimerMenu(false); }} />
              {showScheduleMenu && (
                  <div className="floating-menu schedule-menu">
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
          {/* --- NEW: AUDIO WAVEFORM UI --- */}
          {isRecording ? (
            <div className="recording-ui">
               <span className="rec-text">Recording Audio... (Click Stop)</span>
               <div className="waveform">
                   <span className="bar"></span><span className="bar"></span><span className="bar"></span>
                   <span className="bar"></span><span className="bar"></span><span className="bar"></span>
               </div>
            </div>
          ) : isCodeMode ? (
            <textarea 
              placeholder="Paste your code snippet here..." 
              onChange={handleChange} 
              value={msg} 
              onPaste={handlePaste} 
              rows="2" 
              disabled={isUploading}
            />
          ) : (
            <input
              type="text"
              placeholder={isUploading ? "Uploading media..." : "Type a message or paste (Ctrl+V) an image..."}
              onChange={handleChange}
              value={msg}
              onPaste={handlePaste}
              onBlur={() => handleTyping(false)}
              disabled={isUploading}
            />
          )}
          
          <button type="submit" className={scheduleDate ? 'schedule-btn' : ''} disabled={isRecording || isUploading}>
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

// --- NEW: WAVE ANIMATION ---
const wave = keyframes`
  0%, 100% { height: 8px; }
  50% { height: 24px; }
`;

const PreviewOverlay = styled.div`
    position: absolute; bottom: 85px; left: 0; right: 0;
    display: flex; justify-content: center; z-index: 100;
    
    .preview-container {
        background: rgba(26, 26, 37, 0.95); backdrop-filter: blur(15px);
        border-radius: 1.5rem; padding: 1.2rem;
        box-shadow: 0 15px 40px rgba(0,0,0,0.8);
        border: 1px solid rgba(255,255,255,0.1);
        display: flex; flex-direction: column; gap: 1rem;
        width: 380px; animation: ${popIn} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        
        .preview-header {
            display: flex; justify-content: space-between; color: white; font-weight: bold;
            .close-btn { cursor: pointer; font-size: 1.5rem; transition: 0.2s; &:hover { color: #ff4e4e; transform: scale(1.1); } }
        }

        img, video { width: 100%; max-height: 250px; object-fit: contain; border-radius: 0.8rem; background: rgba(0,0,0,0.5); }
        .file-preview-icon { height: 120px; display: flex; align-items: center; justify-content: center; text-align: center; background: rgba(255,255,255,0.05); color: white; border-radius: 0.8rem; border: 2px dashed rgba(255,255,255,0.2); }

        .media-options {
            display: flex; justify-content: center;
            .view-once-toggle {
                display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05);
                padding: 0.5rem 1rem; border-radius: 2rem; cursor: pointer; color: #ccc; font-size: 0.85rem;
                transition: 0.3s; border: 1px solid transparent;
                &:hover { background: rgba(255,255,255,0.1); }
                &.active { background: rgba(255, 85, 0, 0.1); color: #ff5500; border-color: #ff5500; font-weight: bold; }
                input:disabled + svg { opacity: 0.5; }
            }
        }

        .preview-actions {
            display: flex; gap: 0.8rem;
            input { flex: 1; padding: 0.9rem 1.2rem; border-radius: 2rem; border: none; background: rgba(255,255,255,0.08); color: white; outline: none; transition: 0.3s; &:focus { background: rgba(255,255,255,0.15); box-shadow: 0 0 10px rgba(78, 14, 255, 0.3); } &:disabled { opacity: 0.5; } }
            button { background: #4e0eff; border: none; border-radius: 50%; min-width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; font-size: 1.2rem; transition: 0.3s; &:hover:not(:disabled) { background: #9a86f3; transform: scale(1.05); } &:disabled { background: #555; cursor: not-allowed; } }
            .spin-icon { animation: fa-spin 1s infinite linear; }
        }
    }
`;

const Wrapper = styled.div`
  display: flex; flex-direction: column; width: 100%; position: relative; 
  
  .status-badges {
      position: absolute; top: -35px; left: 2rem; display: flex; gap: 0.8rem; z-index: 10;
      .badge {
          display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; border-radius: 1rem; font-size: 0.75rem; font-weight: bold; cursor: pointer; color: white; animation: ${popIn} 0.3s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          .close { margin-left: 5px; opacity: 0.6; &:hover { opacity: 1; } }
      }
      .timer-badge { background: rgba(255, 85, 0, 0.2); border: 1px solid #ff5500; color: #ff5500; backdrop-filter: blur(5px); }
      .schedule-badge { background: rgba(0, 255, 136, 0.2); border: 1px solid #00ff88; color: #00ff88; backdrop-filter: blur(5px); }
  }

  .reply-banner {
      background: rgba(154, 65, 254, 0.15); backdrop-filter: blur(10px); padding: 0.6rem 2rem; display: flex; justify-content: space-between; align-items: center; color: #ccc; font-size: 0.85rem; border-top: 1px solid rgba(255, 255, 255, 0.05);
      .close-btn { cursor: pointer; color: white; font-size: 1.2rem; transition: 0.2s; &:hover { color: #ff4e4e; transform: scale(1.2); } }
  }
  .edit-banner { background: rgba(0, 255, 136, 0.15); }
  .link-banner { background: rgba(52, 183, 241, 0.1); border-top: 1px solid rgba(52, 183, 241, 0.2); justify-content: flex-start; animation: ${popIn} 0.3s ease; }
  
  @keyframes fa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const Container = styled.div`
  display: grid; grid-template-columns: 25% 75%; align-items: center;
  background-color: rgba(255, 255, 255, 0.02); padding: 0 2rem; min-height: 10%; border-top: 1px solid rgba(255, 255, 255, 0.05);
  
  /* --- NEW: RECORDING BACKGROUND PULSE --- */
  ${({ $isRecording }) => $isRecording && css`
     background: rgba(255, 78, 78, 0.05);
     box-shadow: inset 0 0 20px rgba(255, 78, 78, 0.1);
  `}

  @media screen and (max-width: 1080px) { grid-template-columns: 35% 65%; }
  @media screen and (max-width: 720px) { padding: 0 1rem; gap: 1rem; grid-template-columns: 40% 60%; }
  
  .button-container {
    display: flex; align-items: center; color: white; gap: 1.2rem;
    
    .emoji, .upload, .mic, .tool-toggle {
      position: relative; cursor: pointer;
      svg { font-size: 1.5rem; color: #999; transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); &:hover { color: #fff; transform: scale(1.15) translateY(-2px); } }
      &.active svg { color: #4e0eff; filter: drop-shadow(0 0 5px rgba(78,14,255,0.5)); }
    }
    
    .emoji svg { color: #ffff00c8; }
    .upload svg { color: #34B7F1; }
    .mic .recording-active { color: #ff4e4e; animation: ${pulse} 1s infinite; filter: drop-shadow(0 0 10px #ff4e4e); }
    .code-toggle.active svg { color: #00ff88; filter: drop-shadow(0 0 5px #00ff88); }

    .floating-menu {
      position: absolute; bottom: 50px; left: 0; background: rgba(13, 13, 48, 0.95); backdrop-filter: blur(15px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.8); border: 1px solid rgba(78, 14, 255, 0.3); border-radius: 1rem; z-index: 99;
      animation: ${popIn} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .emoji-picker-react { border: none; .epr-body::-webkit-scrollbar { width: 4px; &-thumb { background-color: #4e0eff; border-radius: 10px; } } }

    .timer-menu, .schedule-menu {
        padding: 1.2rem; width: 220px; display: flex; flex-direction: column; gap: 0.6rem;
        h4 { color: white; margin-top: 0; margin-bottom: 0.5rem; font-size: 0.9rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
        button { background: rgba(255,255,255,0.05); border: 1px solid transparent; color: white; padding: 0.6rem; border-radius: 0.5rem; cursor: pointer; transition: 0.2s; &:hover { background: rgba(255,255,255,0.1); } &.selected { background: #4e0eff; font-weight: bold; box-shadow: 0 0 10px rgba(78,14,255,0.3); } }
        input[type="datetime-local"] { background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(78,14,255,0.3); padding: 0.8rem; border-radius: 0.5rem; outline: none; margin-bottom: 0.5rem; font-family: inherit; color-scheme: dark; }
    }
  }

  .input-container {
    width: 100%; border-radius: 2rem; display: flex; align-items: center; gap: 1rem;
    background-color: rgba(255, 255, 255, 0.05); padding: 0.4rem; transition: 0.3s;
    border: 1px solid transparent;
    &:focus-within { background-color: rgba(255, 255, 255, 0.08); border-color: rgba(78, 14, 255, 0.3); box-shadow: 0 0 15px rgba(78, 14, 255, 0.1); }
    
    /* --- NEW: WAVEFORM STYLES --- */
    .recording-ui {
        width: 100%; height: 60%; display: flex; align-items: center; justify-content: space-between; padding-left: 1.5rem; padding-right: 1rem;
        .rec-text { color: #ff4e4e; font-style: italic; font-weight: bold; animation: ${pulse} 1.5s infinite; }
        .waveform {
            display: flex; align-items: center; gap: 4px; height: 30px;
            .bar { display: block; width: 4px; background: #ff4e4e; border-radius: 4px; animation: ${wave} 1s ease-in-out infinite; }
            .bar:nth-child(2) { animation-delay: 0.1s; } .bar:nth-child(3) { animation-delay: 0.2s; }
            .bar:nth-child(4) { animation-delay: 0.3s; } .bar:nth-child(5) { animation-delay: 0.4s; }
            .bar:nth-child(6) { animation-delay: 0.5s; }
        }
    }

    input { width: 100%; height: 60%; background-color: transparent; color: white; border: none; padding-left: 1.5rem; font-size: 1.1rem; &::selection { background-color: #9a86f3; } &:focus { outline: none; } &:disabled { opacity: 0.5; cursor: not-allowed; } }
    textarea { width: 100%; background-color: transparent; color: #00ff88; border: none; padding-left: 1.5rem; font-size: 1rem; resize: none; font-family: 'JetBrains Mono', monospace; &:focus { outline: none; } &:disabled { opacity: 0.5; cursor: not-allowed; } }
    
    button {
      padding: 0.6rem 1.5rem; border-radius: 2rem; display: flex; justify-content: center; align-items: center;
      background: linear-gradient(135deg, #4e0eff 0%, #9a41fe 100%); border: none; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(78, 14, 255, 0.3);
      svg { font-size: 1.5rem; color: white; }
      &:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 6px 20px rgba(78, 14, 255, 0.5); }
      &:disabled { background: #555; cursor: not-allowed; box-shadow: none; }
      &.schedule-btn { background: linear-gradient(135deg, #00ff88 0%, #00b35f 100%); box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3); }
      .spin-icon { animation: fa-spin 1s infinite linear; }
    }
  }
`;