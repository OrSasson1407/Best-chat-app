import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import axios from "axios";
import { 
    sendMessageRoute, 
    receiveMessageRoute, 
    getGroupMessagesRoute, 
    addGroupMemberRoute,
    reactMessageRoute,
    deleteMessageRoute, 
    editMessageRoute 
} from "../utils/APIRoutes";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { FaUserPlus, FaShieldAlt, FaReply, FaSmile, FaTrash, FaPen } from "react-icons/fa";

export default function ChatContainer({ currentChat, currentUser, socket, isTyping }) {
  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const scrollRef = useRef();

  // 1. Fetch History (Group vs Direct)
  useEffect(() => {
    async function fetchHistory() {
      if (currentChat && currentUser) {
        let response;
        try {
            if (currentChat.admin) { 
                response = await axios.post(getGroupMessagesRoute, {
                    from: currentUser._id,
                    groupId: currentChat._id,
                });
                if (socket.current) {
                    socket.current.emit("join-group", currentChat._id);
                }
            } else {
                response = await axios.post(receiveMessageRoute, {
                    from: currentUser._id,
                    to: currentChat._id,
                });
            }
            setMessages(response.data);

            // Mark unread messages as read when opening the chat
            response.data.forEach((msg) => {
                if (!msg.fromSelf && msg.status !== "read" && socket.current) {
                    socket.current.emit("mark-as-read", { 
                        messageId: msg.id, 
                        from: currentUser._id, 
                        to: currentChat._id 
                    });
                }
            });

        } catch (error) {
            console.error("Error fetching messages:", error);
        }
      }
    }
    fetchHistory();
  }, [currentChat, currentUser, socket]);

  // 2. Real-time Message Listeners
  useEffect(() => {
    if (socket.current) {
      const s = socket.current;
      
      const handleMsgRecieve = (data) => {
        setArrivalMessage({ 
            id: data.id,
            fromSelf: false, 
            message: data.msg, 
            type: data.type, 
            createdAt: data.createdAt,
            username: data.username,
            replyTo: data.replyTo,
            reactions: [],
            status: "delivered",
            isDeleted: false,
            isEdited: false
        });

        // Immediately notify sender that we read it
        s.emit("mark-as-read", { 
            messageId: data.id, 
            from: currentUser._id, 
            to: data.from 
        });
      };

      const handleReactionReceive = (data) => {
          setMessages(prev => prev.map(msg => {
              if (msg.id === data.messageId) {
                  return { ...msg, reactions: data.reactions };
              }
              return msg;
          }));
      };

      const handleMsgReadUpdate = ({ messageId }) => {
          setMessages((prev) => 
              prev.map(msg => msg.id === messageId ? { ...msg, status: "read" } : msg)
          );
      };

      // Handle incoming message edits and deletes
      const handleMsgDeleted = ({ messageId }) => {
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isDeleted: true, message: "🚫 This message was deleted", reactions: [] } : msg));
      };

      const handleMsgEdited = ({ messageId, newText }) => {
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isEdited: true, message: newText } : msg));
      };

      s.on("msg-recieve", handleMsgRecieve);
      s.on("receive-reaction", handleReactionReceive);
      s.on("msg-read-update", handleMsgReadUpdate);
      s.on("msg-deleted", handleMsgDeleted);
      s.on("msg-edited", handleMsgEdited);

      return () => {
          s.off("msg-recieve", handleMsgRecieve);
          s.off("receive-reaction", handleReactionReceive);
          s.off("msg-read-update", handleMsgReadUpdate);
          s.off("msg-deleted", handleMsgDeleted);
          s.off("msg-edited", handleMsgEdited);
      };
    }
  }, [socket, currentUser]);

  // 3. Update State on Arrival
  useEffect(() => {
    if (arrivalMessage) {
      setMessages((prev) => [...prev, arrivalMessage]);
    }
  }, [arrivalMessage]);

  // 4. Send Message Handler
  const handleSendMsg = async (msg, type = "text", replyToId = null) => {
    const time = new Date().toISOString();
    
    try {
        const payload = {
            from: currentUser._id, 
            to: currentChat._id, 
            message: msg, 
            type,
            replyTo: replyToId
        };

        const res = await axios.post(sendMessageRoute, payload);
        const newMessageId = res.data.data?._id || uuidv4();

        const socketData = {
            id: newMessageId,
            to: currentChat._id, 
            from: currentUser._id, 
            msg, 
            type,
            isGroup: !!currentChat.admin, 
            username: currentUser.username,
            replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, type: replyingTo.type, isSelfQuote: replyingTo.isSelfQuote } : null
        };
        
        socket.current.emit("send-msg", socketData);

        setMessages((prev) => [
            ...prev, 
            { 
              id: newMessageId, 
              fromSelf: true, 
              message: msg, 
              type: type, 
              createdAt: time, 
              replyTo: socketData.replyTo, 
              reactions: [],
              status: "sent",
              isDeleted: false,
              isEdited: false
            }
        ]);
        setReplyingTo(null); 
    } catch (error) {
        toast.error("Failed to send message");
    }
  };

  // Handle Editing Submit
  const handleEditMsgSubmit = async (messageId, newText) => {
      try {
          await axios.post(editMessageRoute, { messageId, newText }); 
          
          socket.current.emit("edit-msg", { messageId, newText, to: currentChat._id, isGroup: !!currentChat.admin });
          
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, message: newText, isEdited: true } : msg));
          setEditingMessage(null);
      } catch (error) {
          toast.error("Failed to edit message");
      }
  };

  // Handle Deleting
  const handleDeleteMsg = async (messageId) => {
      if(window.confirm("Delete message for everyone?")) {
          try {
              await axios.post(deleteMessageRoute, { messageId }); 

              socket.current.emit("delete-msg", { messageId, to: currentChat._id, isGroup: !!currentChat.admin });
              
              setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isDeleted: true, message: "🚫 This message was deleted", reactions: [] } : msg));
          } catch (error) {
              toast.error("Failed to delete message");
          }
      }
  };

  // 5. Reaction Handler
  const handleReaction = async (messageId, emoji) => {
      try {
          const res = await axios.post(reactMessageRoute, {
              messageId, emoji, userId: currentUser._id, username: currentUser.username
          });
          
          const updatedReactions = res.data.reactions;
          
          setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg));

          socket.current.emit("send-reaction", {
              messageId, reactions: updatedReactions, to: currentChat._id, isGroup: !!currentChat.admin
          });
      } catch (e) {
          console.error("Failed to react", e);
      }
  };

  // 6. Typing Handler
  const handleTyping = (typing) => {
    socket.current.emit("typing", {
      to: currentChat._id, 
      from: currentUser._id, 
      isTyping: typing,
      isGroup: !!currentChat.admin, 
      username: currentUser.username
    });
  };

  // 7. Admin Action: Add Member
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

  // Scroll to Original Message
  const scrollToMessage = (msgId) => {
      const element = document.getElementById(`msg-${msgId}`);
      if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("highlight-flash");
          setTimeout(() => element.classList.remove("highlight-flash"), 1500);
      }
  };

  // 8. Auto Scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Helpers
  const formatTime = (timeStr) => {
    const date = timeStr ? new Date(timeStr) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusTicks = (status) => {
    if (status === "read") return <span className="tick-read">✓✓</span>;
    if (status === "delivered") return <span className="tick-delivered">✓✓</span>;
    return <span className="tick-sent">✓</span>;
  };

  const renderMessageContent = (msg) => {
    if (msg.isDeleted) return <p className="deleted-text">{msg.message}</p>;
    if (msg.type === "image") return <img src={msg.message} alt="sent" className="msg-image" />;
    if (msg.type === "audio") return <audio controls src={msg.message} className="msg-audio" />;
    if (msg.type === "code") return (
        <pre className="code-snippet">
            <code>{msg.message}</code>
        </pre>
    );
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
          <div ref={scrollRef} key={message.id || uuidv4()} id={`msg-${message.id}`}>
            <div className={`message ${message.fromSelf ? "sended" : "recieved"} ${message.isDeleted ? "deleted-msg" : ""}`}>
              <div className="content">
                
                {/* Quoted Reply UI */}
                {message.replyTo && (
                    <div className="quoted-message" onClick={() => scrollToMessage(message.replyTo.id)}>
                        <span>{message.replyTo.isSelfQuote ? "You" : "Them"}: </span>
                        {message.replyTo.type === "image" ? "[Image]" : message.replyTo.text.substring(0,40)}
                    </div>
                )}

                {/* Show Sender Name in Groups (if not self) */}
                {!message.fromSelf && currentChat.admin && (
                    <span className="sender-name">{message.username}</span>
                )}
                
                {renderMessageContent(message)}
                
                <div className="meta">
                  <span>{formatTime(message.createdAt)}</span>
                  {message.isEdited && <span className="edited-tag">(edited)</span>}
                  {message.fromSelf && !message.isDeleted && (
                    <span className="read-status">
                      {renderStatusTicks(message.status)}
                    </span>
                  )}
                </div>

                {/* Message Actions - Now ALWAYS VISIBLE */}
                {!message.isDeleted && (
                    <div className="message-actions">
                        <button onClick={() => setReplyingTo({ id: message.id, text: message.message, type: message.type, isSelfQuote: message.fromSelf })} title="Reply"><FaReply /></button>
                        <div className="reaction-trigger">
                            <FaSmile title="React"/>
                            <div className="reaction-menu">
                                {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                                    <span key={emoji} onClick={() => handleReaction(message.id, emoji)}>{emoji}</span>
                                ))}
                            </div>
                        </div>
                        {message.fromSelf && message.type === "text" && (
                            <button onClick={() => setEditingMessage({ id: message.id, text: message.message })} title="Edit"><FaPen size={12}/></button>
                        )}
                        {message.fromSelf && (
                            <button onClick={() => handleDeleteMsg(message.id)} title="Delete"><FaTrash size={12}/></button>
                        )}
                    </div>
                )}

                {/* Render Reactions */}
                {message.reactions?.length > 0 && !message.isDeleted && (
                    <div className="reactions-display">
                        {message.reactions.map((r, i) => <span key={i} title={r.username}>{r.emoji}</span>)}
                    </div>
                )}
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
      
      <ChatInput 
          handleSendMsg={handleSendMsg} 
          handleTyping={handleTyping} 
          replyingTo={replyingTo} 
          setReplyingTo={setReplyingTo} 
          editingMessage={editingMessage}
          setEditingMessage={setEditingMessage}
          handleEditMsgSubmit={handleEditMsgSubmit}
      />
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

    .highlight-flash {
        animation: flashBg 1.5s ease-out;
    }
    @keyframes flashBg {
        0% { background-color: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        100% { background-color: transparent; }
    }

    .message {
      display: flex; align-items: center; position: relative;
      
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

        .deleted-text { font-style: italic; color: rgba(255,255,255,0.5); font-size: 0.9rem; }
        .edited-tag { font-size: 0.6rem; opacity: 0.5; margin-left: 5px; font-style: italic; }

        /* Quoted Message Styling */
        .quoted-message {
            background: rgba(0,0,0,0.2); border-left: 4px solid #00ff88;
            padding: 0.5rem; border-radius: 0.3rem; font-size: 0.8rem; margin-bottom: 0.5rem;
            color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            cursor: pointer; transition: 0.2s;
            &:hover { background: rgba(0,0,0,0.4); }
            span { font-weight: bold; color: #00ff88; }
        }

        /* Code Snippet Styling */
        .code-snippet {
            background: #1e1e1e; padding: 1rem; border-radius: 0.5rem;
            overflow-x: auto; font-family: 'Courier New', Courier, monospace;
            color: #00ff88; border: 1px solid #333; margin: 0.5rem 0;
            code { white-space: pre-wrap; word-break: break-all; }
        }

        /* Media */
        .msg-image { max-width: 100%; border-radius: 0.8rem; margin-top: 5px; }
        .msg-audio { max-width: 220px; margin-top: 5px; height: 40px; }

        .meta {
            display: flex; justify-content: flex-end; align-items: center;
            gap: 5px; font-size: 0.65rem; opacity: 0.7; margin-top: 5px;
            
            /* Tick Styles */
            .read-status { 
                font-weight: bold; font-size: 0.8rem; display: flex; align-items: center;
                .tick-sent { color: #ccc; }
                .tick-delivered { color: #ccc; }
                .tick-read { color: #34B7F1; /* WhatsApp Blue */ }
            }
        }

        /* FIX: Made the buttons ALWAYS VISIBLE so you can see them clearly */
        .message-actions {
            position: absolute; top: -15px; right: 10px;
            background: #2a2a35; padding: 0.3rem 0.5rem; border-radius: 1rem;
            display: flex; gap: 0.5rem; 
            opacity: 1; /* Was 0 */
            visibility: visible; /* Was hidden */
            transition: 0.2s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            z-index: 5;
            
            button, .reaction-trigger {
                background: none; border: none; color: #aaa; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                &:hover { color: #fff; }
            }

            .reaction-trigger {
                position: relative;
                &:hover .reaction-menu { display: flex; }
                .reaction-menu {
                    display: none; position: absolute; bottom: 120%; left: 50%;
                    transform: translateX(-50%); background: #1a1a25; padding: 0.5rem;
                    border-radius: 2rem; gap: 0.5rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                    span { cursor: pointer; transition: 0.2s; font-size: 1.2rem; &:hover { transform: scale(1.3); } }
                }
            }
        }

        /* Displaying Reactions */
        .reactions-display {
            position: absolute; bottom: -12px; right: 10px;
            background: #1a1a25; padding: 0.2rem 0.4rem; border-radius: 1rem;
            font-size: 0.8rem; display: flex; gap: 0.2rem;
            border: 1px solid rgba(255,255,255,0.1);
        }
      }
    }

    .deleted-msg .content {
        background: transparent !important;
        border: 1px dashed rgba(255,255,255,0.2) !important;
        box-shadow: none !important;
    }

    .sended {
      justify-content: flex-end;
      .content {
        background: linear-gradient(135deg, #4e0eff 0%, #9a41fe 100%);
        border-bottom-right-radius: 0.2rem;
        box-shadow: 0 4px 15px rgba(78, 14, 255, 0.3);
      }
      .message-actions { right: auto; left: 10px; } /* Flip action menu for sent messages */
      .reactions-display { right: auto; left: 10px; }
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