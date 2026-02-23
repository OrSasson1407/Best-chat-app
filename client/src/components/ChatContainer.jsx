import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import axios from "axios";
import { 
    sendMessageRoute, 
    receiveMessageRoute, 
    getGroupMessagesRoute, 
    addGroupMemberRoute 
} from "../utils/APIRoutes";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { FaUserPlus, FaShieldAlt } from "react-icons/fa";

export default function ChatContainer({ currentChat, currentUser, socket, isTyping }) {
  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const scrollRef = useRef();

  // 1. Fetch History (Group vs Direct)
  useEffect(() => {
    async function fetchHistory() {
      if (currentChat && currentUser) {
        let response;
        try {
            if (currentChat.admin) { 
                // It's a Group (has 'admin' field)
                response = await axios.post(getGroupMessagesRoute, {
                    from: currentUser._id,
                    groupId: currentChat._id,
                });
                // Join Socket Room for this Group
                if (socket.current) {
                    socket.current.emit("join-group", currentChat._id);
                }
            } else {
                // It's a Direct Message
                response = await axios.post(receiveMessageRoute, {
                    from: currentUser._id,
                    to: currentChat._id,
                });
            }
            setMessages(response.data);
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
      }
    }
    fetchHistory();
  }, [currentChat, currentUser, socket]);

  // 2. Real-time Message Listener
  useEffect(() => {
    if (socket.current) {
      const s = socket.current;
      // Setup listener
      const handleMsgRecieve = (data) => {
        setArrivalMessage({ 
            fromSelf: false, 
            message: data.msg, 
            type: data.type, 
            createdAt: data.createdAt,
            username: data.username // Group chats need sender name
        });
      };

      s.on("msg-recieve", handleMsgRecieve);

      return () => {
          s.off("msg-recieve", handleMsgRecieve);
      };
    }
  }, [socket]);

  // 3. Update State on Arrival
  useEffect(() => {
    if (arrivalMessage) {
      // For direct chats: Only add if from current chatter
      // For groups: Handled by room logic, but safe to add
      setMessages((prev) => [...prev, arrivalMessage]);
    }
  }, [arrivalMessage]);

  // 4. Send Message Handler
  const handleSendMsg = async (msg, type = "text") => {
    const time = new Date().toISOString();
    
    try {
        if (currentChat.admin) {
            // --- SENDING TO GROUP ---
            await axios.post(sendMessageRoute, { 
                from: currentUser._id, 
                to: currentChat._id, // Group ID 
                message: msg, 
                type 
            });
            
            socket.current.emit("send-msg", {
                to: currentChat._id, 
                from: currentUser._id, 
                msg, 
                type,
                isGroup: true, 
                username: currentUser.username
            });
        } else {
            // --- SENDING DIRECT ---
            await axios.post(sendMessageRoute, { 
                from: currentUser._id, 
                to: currentChat._id, 
                message: msg, 
                type 
            });
            
            socket.current.emit("send-msg", {
                to: currentChat._id, 
                from: currentUser._id, 
                msg, 
                type,
                isGroup: false
            });
        }

        // Update Local UI
        setMessages((prev) => [
            ...prev, 
            { fromSelf: true, message: msg, type: type, createdAt: time }
        ]);
    } catch (error) {
        toast.error("Failed to send message");
    }
  };

  // 5. Typing Handler
  const handleTyping = (typing) => {
    socket.current.emit("typing", {
      to: currentChat._id, 
      from: currentUser._id, 
      isTyping: typing,
      isGroup: !!currentChat.admin, 
      username: currentUser.username
    });
  };

  // 6. Admin Action: Add Member
  const handleAddMember = async () => {
      const userId = prompt("Enter the User ID to add to this group:");
      if (userId) {
          try {
            await axios.post(addGroupMemberRoute, { groupId: currentChat._id, userId });
            toast.success("Member added successfully");
          } catch (e) {
            toast.error("Failed to add member");
          }
      }
  };

  // 7. Auto Scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Helpers
  const formatTime = (timeStr) => {
    const date = timeStr ? new Date(timeStr) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageContent = (msg) => {
    if (msg.type === "image") return <img src={msg.message} alt="sent" className="msg-image" />;
    if (msg.type === "audio") return <audio controls src={msg.message} className="msg-audio" />;
    return <p>{msg.message}</p>;
  };

  return (
    <Container>
      <div className="chat-header">
        <div className="user-details">
          <h3>{currentChat.name || currentChat.username}</h3>
          
          {/* Admin Controls Badge */}
          {currentChat.admin === currentUser._id && (
              <div className="admin-controls">
                  <span className="admin-badge"><FaShieldAlt /> Admin</span>
                  <FaUserPlus className="add-icon" onClick={handleAddMember} title="Add Member" />
              </div>
          )}
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div ref={scrollRef} key={uuidv4()}>
            <div className={`message ${message.fromSelf ? "sended" : "recieved"}`}>
              <div className="content">
                {/* Show Sender Name in Groups (if not self) */}
                {!message.fromSelf && currentChat.admin && (
                    <span className="sender-name">{message.username}</span>
                )}
                
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
                <span>Someone is typing...</span>
            </div>
        )}
      </div>
      
      <ChatInput handleSendMsg={handleSendMsg} handleTyping={handleTyping} />
    </Container>
  );
}

// --- STYLES ---

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  overflow: hidden;

  .chat-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 2rem;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    
    .user-details {
      display: flex; align-items: center; gap: 1.5rem;
      h3 { color: white; font-weight: 500; }
    }
    
    .admin-controls {
        display: flex; align-items: center; gap: 1rem;
        
        .admin-badge {
            background: rgba(0, 255, 136, 0.1);
            color: #00ff88;
            padding: 0.3rem 0.6rem;
            border-radius: 0.5rem;
            border: 1px solid #00ff88;
            font-size: 0.7rem;
            font-weight: bold;
            display: flex; align-items: center; gap: 0.3rem;
        }

        .add-icon {
            color: #00ff88; cursor: pointer; font-size: 1.2rem;
            transition: 0.2s;
            &:hover { transform: scale(1.1); color: white; }
        }
    }
  }

  .chat-messages {
    padding: 1.5rem 2rem;
    display: flex; flex-direction: column; gap: 1rem;
    overflow: auto;
    
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 1rem; }

    .message {
      display: flex; align-items: center;
      
      .content {
        max-width: 60%;
        padding: 0.8rem 1rem;
        font-size: 1rem;
        border-radius: 1.2rem;
        color: #fff;
        line-height: 1.4;
        display: flex; flex-direction: column;
        position: relative;
        min-width: 120px;

        .sender-name {
            font-size: 0.75rem;
            color: #ff0055; 
            font-weight: bold; 
            margin-bottom: 4px;
            text-transform: capitalize;
        }

        /* Media */
        .msg-image { max-width: 100%; border-radius: 0.8rem; margin-top: 5px; }
        .msg-audio { max-width: 220px; margin-top: 5px; height: 40px; }

        .meta {
            display: flex; justify-content: flex-end; align-items: center;
            gap: 5px; font-size: 0.65rem; opacity: 0.7; margin-top: 5px;
            .read-status { color: #00ff88; font-weight: bold; font-size: 0.8rem; }
        }
      }
    }

    .sended {
      justify-content: flex-end;
      .content {
        background: linear-gradient(135deg, #4e0eff 0%, #9a41fe 100%);
        border-bottom-right-radius: 0.2rem;
        box-shadow: 0 4px 15px rgba(78, 14, 255, 0.3);
      }
    }

    .recieved {
      justify-content: flex-start;
      .content {
        background: rgba(255, 255, 255, 0.08);
        border-bottom-left-radius: 0.2rem;
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255,255,255,0.05);
      }
    }
    
    .typing-indicator {
        color: #00ff88; font-size: 0.8rem; margin-left: 1rem; 
        font-style: italic; animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 0.5; }
        50% { opacity: 1; }
        100% { opacity: 0.5; }
    }
  }
`;