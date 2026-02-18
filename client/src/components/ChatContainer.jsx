import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import axios from "axios";
import { sendMessageRoute, receiveMessageRoute } from "../utils/APIRoutes";
import { v4 as uuidv4 } from "uuid";

export default function ChatContainer({ currentChat, currentUser, socket, isTyping }) {
  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const scrollRef = useRef();

  // 1. Fetch History
  useEffect(() => {
    async function fetchHistory() {
      if (currentChat && currentUser) {
        const response = await axios.post(receiveMessageRoute, {
          from: currentUser._id,
          to: currentChat._id,
        });
        setMessages(response.data);
      }
    }
    fetchHistory();
  }, [currentChat, currentUser]);

  // 2. Socket Listener
  useEffect(() => {
    if (socket.current) {
      const s = socket.current;
      s.on("msg-recieve", (data) => {
        if (currentChat._id === data.from) {
          setArrivalMessage({ 
            fromSelf: false, 
            message: data.msg, 
            type: data.type, 
            createdAt: data.createdAt 
          });
        }
      });
      return () => s.off("msg-recieve");
    }
  }, [currentChat, socket]);

  // 3. Update Messages
  useEffect(() => {
    if (arrivalMessage) {
      setMessages((prev) => [...prev, arrivalMessage]);
      setArrivalMessage(null);
    }
  }, [arrivalMessage]);

  // 4. Send Message Handler (Text/Image/Audio)
  const handleSendMsg = async (msg, type = "text") => {
    const time = new Date().toISOString();
    
    // Save to DB
    await axios.post(sendMessageRoute, {
      from: currentUser._id,
      to: currentChat._id,
      message: msg,
      type: type, 
    });

    // Emit to Socket
    socket.current.emit("send-msg", {
      to: currentChat._id,
      from: currentUser._id,
      msg: msg,
      type: type,
    });

    // Update Local UI
    setMessages((prev) => [
      ...prev, 
      { fromSelf: true, message: msg, type: type, createdAt: time }
    ]);
  };

  const handleTyping = (typing) => {
    socket.current.emit("typing", {
      to: currentChat._id,
      from: currentUser._id,
      isTyping: typing,
    });
  };

  // 5. Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const formatTime = (timeStr) => {
    const date = timeStr ? new Date(timeStr) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper: Render content based on type
  const renderMessageContent = (msg) => {
    if (msg.type === "image") {
      return <img src={msg.message} alt="sent image" className="msg-image" />;
    }
    if (msg.type === "audio") {
      return <audio controls src={msg.message} className="msg-audio" />;
    }
    return <p>{msg.message}</p>;
  };

  return (
    <Container>
      <div className="chat-header">
        <div className="user-details">
          <h3>{currentChat.username}</h3>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div ref={scrollRef} key={uuidv4()}>
            <div className={`message ${message.fromSelf ? "sended" : "recieved"}`}>
              <div className="content">
                {renderMessageContent(message)}
                
                <div className="meta">
                  <span>{formatTime(message.createdAt)}</span>
                  {message.fromSelf && <span className="read-status">✓✓</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="typing-indicator" ref={scrollRef}>
            <span>{currentChat.username} is typing...</span>
          </div>
        )}
      </div>
      
      <ChatInput handleSendMsg={handleSendMsg} handleTyping={handleTyping} />
    </Container>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  overflow: hidden;

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    .user-details h3 { color: white; font-weight: 500; }
  }

  .chat-messages {
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
    &::-webkit-scrollbar { width: 2px; }
    &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 1rem; }

    .message {
      display: flex;
      align-items: center;
      .content {
        max-width: 50%;
        padding: 0.8rem 1rem;
        font-size: 1rem;
        border-radius: 1.2rem;
        color: #fff;
        line-height: 1.4;
        
        /* Media Styling */
        .msg-image {
          max-width: 100%;
          border-radius: 1rem;
          margin-bottom: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .msg-audio {
          max-width: 200px;
          filter: invert(1); /* Invert colors to match dark theme */
        }

        .meta {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 5px;
          font-size: 0.65rem;
          margin-top: 4px;
          opacity: 0.7;
          .read-status { color: #00ff88; font-weight: bold; }
        }
      }
    }

    .sended {
      justify-content: flex-end;
      .content {
        background: linear-gradient(135deg, #4e0eff 0%, #9a41fe 100%);
        border-bottom-right-radius: 0.2rem;
      }
    }

    .recieved {
      justify-content: flex-start;
      .content {
        background: rgba(255, 255, 255, 0.08);
        border-bottom-left-radius: 0.2rem;
        backdrop-filter: blur(5px);
      }
    }
    
    .typing-indicator {
      color: #00ff88;
      font-size: 0.8rem;
      font-style: italic;
      margin-left: 1rem;
    }
  }
`;