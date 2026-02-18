import React, { useState, useRef } from "react";
import styled from "styled-components";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { IoMdSend } from "react-icons/io";
import { BsEmojiSmileFill, BsImage, BsMicFill, BsStopCircleFill } from "react-icons/bs";

export default function ChatInput({ handleSendMsg, handleTyping }) {
  const [msg, setMsg] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs for handling file and audio inputs
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- EMOJI HANDLER ---
  const handleEmojiClick = (emojiData) => {
    let message = msg;
    message += emojiData.emoji;
    setMsg(message);
    handleTyping(true); // Notify server user is typing
  };

  // --- TEXT SEND HANDLER ---
  const sendChat = (event) => {
    event.preventDefault();
    if (msg.length > 0) {
      handleSendMsg(msg, "text"); // Send as 'text'
      setMsg("");
      handleTyping(false);
      setShowEmojiPicker(false);
    }
  };

  const handleChange = (e) => {
    setMsg(e.target.value);
    handleTyping(e.target.value.length > 0);
  };

  // --- IMAGE UPLOAD (Base64) ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSendMsg(reader.result, "image"); // Send Base64 string as 'image'
      };
      reader.readAsDataURL(file);
    }
  };

  // --- VOICE RECORDER (MediaRecorder) ---
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
           handleSendMsg(reader.result, "audio"); // Send Base64 string as 'audio'
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
    <Container>
      <div className="button-container">
        
        {/* Emoji Toggle */}
        <div className="emoji">
          <BsEmojiSmileFill onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
          {showEmojiPicker && (
             <div className="emoji-picker-react">
               <EmojiPicker theme={Theme.DARK} onEmojiClick={handleEmojiClick} />
             </div>
          )}
        </div>

        {/* Image Upload Trigger */}
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

        {/* Voice Record Trigger */}
        <div className="mic" onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? <BsStopCircleFill className="recording-active" /> : <BsMicFill />}
        </div>

      </div>

      {/* Main Input Field */}
      <form className="input-container" onSubmit={(event) => sendChat(event)}>
        <input
          type="text"
          placeholder={isRecording ? "Recording audio..." : "Type your message here..."}
          onChange={handleChange}
          value={msg}
          disabled={isRecording} // Disable typing while recording
          onBlur={() => handleTyping(false)}
        />
        <button type="submit">
          <IoMdSend />
        </button>
      </form>
    </Container>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-columns: 15% 85%;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.02); /* Glass effect */
  padding: 0 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);

  @media screen and (max-width: 720px) {
    padding: 0 1rem;
    gap: 1rem;
    grid-template-columns: 20% 80%;
  }
  
  .button-container {
    display: flex;
    align-items: center;
    color: white;
    gap: 1rem;
    
    .emoji, .upload, .mic {
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