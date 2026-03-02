import React, { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { IoMdSend, IoMdClose, IoMdCheckmark } from "react-icons/io";
import { BsEmojiSmileFill, BsImage, BsMicFill, BsStopCircleFill, BsCodeSlash } from "react-icons/bs";

export default function ChatInput({ handleSendMsg, handleTyping, replyingTo, setReplyingTo, editingMessage, setEditingMessage, handleEditMsgSubmit }) {
  const [msg, setMsg] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Populate input when editing
  useEffect(() => {
      if (editingMessage) {
          setMsg(editingMessage.text);
          setReplyingTo(null); // Clear reply if starting to edit
      }
  }, [editingMessage, setReplyingTo]);

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
          handleSendMsg(msg, isCodeMode ? "code" : "text", replyingTo?.id); 
      }
      setMsg("");
      setIsCodeMode(false);
      setReplyingTo(null);
      handleTyping(false);
      setShowEmojiPicker(false);
    }
  };

  const handleChange = (e) => {
    setMsg(e.target.value);
    handleTyping(e.target.value.length > 0);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result); // Show preview overlay
      };
      reader.readAsDataURL(file);
    }
    e.target.value = null; // reset input
  };

  const confirmSendImage = () => {
      handleSendMsg(imagePreview, "image", replyingTo?.id);
      setImagePreview(null);
      setReplyingTo(null);
      
      // If user typed a caption, send it as a follow-up text message
      if (msg.length > 0) {
          setTimeout(() => sendChat(), 200); 
      }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
           handleSendMsg(reader.result, "audio", replyingTo?.id); 
           setReplyingTo(null);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <Wrapper>
      {/* Reply Banner */}
      {replyingTo && !editingMessage && (
        <div className="reply-banner">
            <span>Replying to: <strong>{replyingTo.text.substring(0, 30)}...</strong></span>
            <IoMdClose onClick={() => setReplyingTo(null)} className="close-btn" />
        </div>
      )}

      {/* Edit Banner */}
      {editingMessage && (
        <div className="reply-banner edit-banner">
            <span>Editing message...</span>
            <IoMdClose onClick={() => { setEditingMessage(null); setMsg(""); }} className="close-btn" />
        </div>
      )}

      {/* Image Preview Overlay */}
      {imagePreview && (
          <PreviewOverlay>
              <div className="preview-container">
                  <div className="preview-header">
                      <span>Preview Image</span>
                      <IoMdClose onClick={() => setImagePreview(null)} className="close-btn" />
                  </div>
                  <img src={imagePreview} alt="Preview" />
                  <div className="preview-actions">
                      <input 
                         type="text" 
                         placeholder="Add a caption..." 
                         value={msg} 
                         onChange={(e) => setMsg(e.target.value)}
                      />
                      <button onClick={confirmSendImage}><IoMdSend /></button>
                  </div>
              </div>
          </PreviewOverlay>
      )}

      <Container>
        <div className="button-container">
          <div className="emoji">
            <BsEmojiSmileFill onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
            {showEmojiPicker && (
               <div className="emoji-picker-react">
                 <EmojiPicker theme={Theme.DARK} onEmojiClick={handleEmojiClick} />
               </div>
            )}
          </div>

          <div className="upload" onClick={() => fileInputRef.current.click()}>
            <BsImage />
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>

          <div className="mic" onClick={isRecording ? stopRecording : startRecording}>
            {isRecording ? <BsStopCircleFill className="recording-active" /> : <BsMicFill />}
          </div>

          <div className={`code-toggle ${isCodeMode ? 'active' : ''}`} onClick={() => setIsCodeMode(!isCodeMode)}>
             <BsCodeSlash />
          </div>
        </div>

        <form className="input-container" onSubmit={(event) => sendChat(event)}>
          {isCodeMode ? (
            <textarea placeholder="Paste your code snippet here..." onChange={handleChange} value={msg} rows="2" />
          ) : (
            <input
              type="text"
              placeholder={isRecording ? "Recording audio..." : "Type your message here..."}
              onChange={handleChange}
              value={msg}
              disabled={isRecording} 
              onBlur={() => handleTyping(false)}
            />
          )}
          <button type="submit">
            {editingMessage ? <IoMdCheckmark /> : <IoMdSend />}
          </button>
        </form>
      </Container>
    </Wrapper>
  );
}

const PreviewOverlay = styled.div`
    position: absolute; bottom: 80px; left: 0; right: 0;
    display: flex; justify-content: center;
    z-index: 100;
    
    .preview-container {
        background: #1a1a25; border-radius: 1rem; padding: 1rem;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
        border: 1px solid rgba(255,255,255,0.1);
        display: flex; flex-direction: column; gap: 1rem;
        width: 350px;
        
        .preview-header {
            display: flex; justify-content: space-between; color: white;
            font-weight: bold;
            .close-btn { cursor: pointer; font-size: 1.5rem; transition: 0.2s; &:hover { color: #ff4e4e; } }
        }

        img { width: 100%; max-height: 250px; object-fit: contain; border-radius: 0.5rem; background: black; }

        .preview-actions {
            display: flex; gap: 0.5rem;
            input {
                flex: 1; padding: 0.8rem; border-radius: 2rem; border: none;
                background: rgba(255,255,255,0.1); color: white;
                &:focus { outline: none; }
            }
            button {
                background: #4e0eff; border: none; border-radius: 50%; width: 40px; height: 40px;
                display: flex; align-items: center; justify-content: center; cursor: pointer;
                color: white; font-size: 1.2rem; transition: 0.2s;
                &:hover { background: #9a86f3; }
            }
        }
    }
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative; 
  
  .reply-banner {
      background: rgba(154, 65, 254, 0.2);
      padding: 0.5rem 2rem;
      display: flex; justify-content: space-between; align-items: center;
      color: #ccc; font-size: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      .close-btn { cursor: pointer; color: white; font-size: 1.2rem; }
  }

  .edit-banner {
      background: rgba(0, 255, 136, 0.2); /* Greenish for edit mode */
  }
`;

const Container = styled.div`
  display: grid;
  grid-template-columns: 20% 80%;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.02);
  padding: 0 2rem;
  min-height: 10%;
  border-top: 1px solid rgba(255, 255, 255, 0.05);

  @media screen and (max-width: 720px) {
    padding: 0 1rem;
    gap: 1rem;
    grid-template-columns: 25% 75%;
  }
  
  .button-container {
    display: flex;
    align-items: center;
    color: white;
    gap: 1rem;
    
    .emoji, .upload, .mic, .code-toggle {
      position: relative;
      cursor: pointer;
      svg {
        font-size: 1.5rem;
        color: #ffff00c8;
        transition: 0.3s ease;
        &:hover { color: #fff; }
      }
    }
    
    .upload svg { color: #0084ff; }
    
    .mic svg { color: #ffffff; }
    .mic .recording-active { color: #ff0000; animation: pulse 1s infinite; }
    
    .code-toggle.active svg { color: #00ff88; }
    .code-toggle svg { color: #aaa; }

    .emoji-picker-react {
      position: absolute;
      top: -470px;
      left: 0;
      background-color: #080420;
      box-shadow: 0 5px 10px #9a86f3;
      border-color: #9a86f3;
      z-index: 99;
      .epr-body::-webkit-scrollbar {
        background-color: #080420;
        width: 5px;
        &-thumb { background-color: #9a86f3; }
      }
    }
  }

  .input-container {
    width: 100%;
    border-radius: 2rem;
    display: flex;
    align-items: center;
    gap: 2rem;
    background-color: rgba(255, 255, 255, 0.1);
    padding: 0.3rem 0;
    
    input {
      width: 90%;
      height: 60%;
      background-color: transparent;
      color: white;
      border: none;
      padding-left: 1rem;
      font-size: 1.2rem;
      &::selection { background-color: #9a86f3; }
      &:focus { outline: none; }
    }
    
    textarea { 
      width: 90%; 
      background-color: transparent; 
      color: #00ff88; 
      border: none; 
      padding-left: 1rem; 
      font-size: 1rem; 
      resize: none; 
      font-family: monospace; 
      &:focus { outline: none; } 
    }
    
    button {
      padding: 0.3rem 2rem;
      border-radius: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #9a86f3;
      border: none;
      cursor: pointer;
      svg { font-size: 2rem; color: white; }
    }
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
`;