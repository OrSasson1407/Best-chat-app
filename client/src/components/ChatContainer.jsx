import React, { useState, useEffect, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import ChatInput from "./ChatInput";
import axios from "axios";
import { Virtuoso } from "react-virtuoso"; // <-- PHASE 3: Virtualization
import { 
    sendMessageRoute, 
    receiveMessageRoute, 
    getGroupMessagesRoute, 
    addGroupMemberRoute,
    reactMessageRoute,
    deleteMessageRoute, 
    editMessageRoute,
    blockUserRoute 
} from "../utils/APIRoutes";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { 
    FaUserPlus, FaShieldAlt, FaReply, FaSmile, FaTrash, FaPen, 
    FaInfoCircle, FaFileDownload, FaShare, FaStar, FaThumbtack, 
    FaFire, FaMicrophoneAlt, FaPoll, FaSearch, FaUserSlash, FaSpinner,
    FaArrowDown, FaCloudUploadAlt, FaTimes, FaClock, FaCheckDouble
} from "react-icons/fa";

export default function ChatContainer({ currentChat, currentUser, socket, isTyping, theme, isCompact }) {
  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true); 
  
  // --- PHASE 3: VIRTUAL SCROLLING STATE ---
  const virtuosoRef = useRef(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // --- PRESENCE STATE ---
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  // --- PHASE 2 STATE: MEDIA & PRODUCTIVITY UX ---
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [readReceiptsMsg, setReadReceiptsMsg] = useState(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);

  const getAuthHeader = () => ({
    headers: { "x-auth-token": currentUser.token },
  });

  // 1. Fetch History
  useEffect(() => {
    async function fetchHistory() {
      if (currentChat && currentUser) {
        setIsFetchingHistory(true);
        let response;
        try {
            if (currentChat.admin) { 
                response = await axios.post(getGroupMessagesRoute, {
                    from: currentUser._id,
                    groupId: currentChat._id,
                }, getAuthHeader());
                if (socket.current) socket.current.emit("join-group", currentChat._id);
            } else {
                response = await axios.post(receiveMessageRoute, {
                    from: currentUser._id,
                    to: currentChat._id,
                }, getAuthHeader());
                setIsBlocked(currentUser.blockedUsers?.includes(currentChat._id));
            }

            const fetchedMessages = response.data.messages ? response.data.messages : response.data;
            setMessages(fetchedMessages);

            if (response.data.nextCursor !== undefined) {
                setCursor(response.data.nextCursor);
                setHasMore(response.data.hasMore);
            } else {
                setHasMore(false); 
            }

            const pinned = fetchedMessages.find(m => m.isPinned);
            setPinnedMessage(pinned || null);

            fetchedMessages.forEach((msg) => {
                if (!msg.fromSelf && msg.status !== "read" && socket.current) {
                    socket.current.emit("mark-as-read", { messageId: msg.id, from: currentUser._id, to: currentChat._id });
                }
            });

        } catch (error) {
            console.error("Error fetching messages:", error);
            if (error.response?.status === 401) toast.error("Session expired. Please login again.");
        } finally {
            setIsFetchingHistory(false);
        }
      }
    }
    fetchHistory();
  }, [currentChat, currentUser]);

  // Phase 3: Virtuoso Load More Logic (Replaces handleScroll)
  const loadMoreMessages = async () => {
    if (hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      try {
          let response;
          if (currentChat.admin) {
              response = await axios.post(getGroupMessagesRoute, { from: currentUser._id, groupId: currentChat._id, cursor }, getAuthHeader());
          } else {
              response = await axios.post(receiveMessageRoute, { from: currentUser._id, to: currentChat._id, cursor }, getAuthHeader());
          }

          const newMessages = response.data.messages ? response.data.messages : response.data;
          
          // Virtuoso automatically preserves scroll position when items are prepended!
          setMessages((prev) => [...newMessages, ...prev]);
          
          if (response.data.nextCursor !== undefined) {
              setCursor(response.data.nextCursor);
              setHasMore(response.data.hasMore);
          } else {
              setHasMore(false);
          }
      } catch (error) {
          console.error("Failed to fetch older messages", error);
      } finally {
          setIsLoadingMore(false);
      }
    }
  };

  const scrollToBottom = () => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
  };

  // Heartbeat System
  useEffect(() => {
      if (socket.current && currentUser) {
          const heartbeatInterval = setInterval(() => {
              socket.current.emit("heartbeat", currentUser._id);
          }, 30000); 
          return () => clearInterval(heartbeatInterval);
      }
  }, [socket, currentUser]);

  // Drag and Drop Overlays
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) toast.info(`Preparing to upload ${files[0].name}...`);
  };

  // Real-time Listeners
  useEffect(() => {
    if (socket.current) {
      const s = socket.current;
      if (currentChat && !currentChat.admin) s.emit("check-presence", currentChat._id);

      const handlePresenceResponse = (data) => {
        if (data.userId === currentChat._id) { setIsOnline(data.isOnline); setLastSeen(data.lastSeen); }
      };

      const handleMsgRecieve = (data) => {
        setArrivalMessage({ 
            id: data.id, fromSelf: false, message: data.msg, type: data.type, 
            createdAt: data.createdAt, username: data.username, replyTo: data.replyTo,
            reactions: [], status: "delivered", isDeleted: false, isEdited: false,
            isForwarded: data.isForwarded, isViewOnce: data.isViewOnce, viewed: false,
            isStarred: false, pollData: data.pollData, linkMetadata: data.linkMetadata
        });
        s.emit("mark-as-read", { messageId: data.id, from: currentUser._id, to: data.from });
      };

      const handleReactionReceive = (data) => {
          setMessages(prev => prev.map(msg => msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg));
      };

      const handleMsgReadUpdate = ({ messageId }) => {
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, status: "read" } : msg));
      };

      const handleMsgDeleted = ({ messageId }) => {
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isDeleted: true, message: "🚫 This message was deleted", reactions: [] } : msg));
      };

      const handleMsgEdited = ({ messageId, newText }) => {
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isEdited: true, message: newText } : msg));
      };

      s.on("presence-response", handlePresenceResponse);
      s.on("user-status-change", handlePresenceResponse);
      s.on("msg-recieve", handleMsgRecieve);
      s.on("receive-reaction", handleReactionReceive);
      s.on("msg-read-update", handleMsgReadUpdate);
      s.on("msg-deleted", handleMsgDeleted);
      s.on("msg-edited", handleMsgEdited);

      return () => {
          s.off("presence-response"); s.off("user-status-change"); s.off("msg-recieve");
          s.off("receive-reaction"); s.off("msg-read-update"); s.off("msg-deleted"); s.off("msg-edited");
      };
    }
  }, [socket, currentUser, currentChat]);

  useEffect(() => {
    if (arrivalMessage) {
        setMessages((prev) => [...prev, arrivalMessage]);
        // Virtuoso automatically follows output when configured
    }
  }, [arrivalMessage]);

  // Send Message Handler
  const handleSendMsg = async (msg, type = "text", replyToId = null, extraData = {}) => {
    const time = new Date().toISOString();
    try {
        const payload = {
            from: currentUser._id, to: currentChat._id, message: msg, type,
            replyTo: replyToId, isForwarded: extraData.isForwarded || false,
            isViewOnce: extraData.isViewOnce || false, pollData: extraData.pollData || null,
            timer: extraData.timer || null 
        };

        const res = await axios.post(sendMessageRoute, payload, getAuthHeader());
        const newMessageId = res.data.data?._id || uuidv4();
        const generatedLinkData = res.data.data?.linkMetadata || null;

        const socketData = {
            id: newMessageId, to: currentChat._id, from: currentUser._id, 
            msg, type: res.data.data?.type || type, isGroup: !!currentChat.admin, 
            username: currentUser.username, replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, type: replyingTo.type, isSelfQuote: replyingTo.isSelfQuote } : null,
            ...payload, linkMetadata: generatedLinkData
        };
        
        socket.current.emit("send-msg", socketData);

        setMessages((prev) => [
            ...prev, 
            { 
              id: newMessageId, fromSelf: true, message: msg, type: socketData.type, createdAt: time, 
              replyTo: socketData.replyTo, reactions: [], status: "sent", isDeleted: false, isEdited: false,
              isForwarded: payload.isForwarded, isViewOnce: payload.isViewOnce, viewed: false, 
              pollData: payload.pollData, linkMetadata: generatedLinkData,
              timer: payload.timer
            }
        ]);
        setReplyingTo(null); 
    } catch (error) {
        if (error.response && error.response.status === 403) toast.error(error.response.data.msg || "You are blocked.");
        else toast.error("Failed to send message");
    }
  };

  const handleEditMsgSubmit = async (messageId, newText) => {
      try {
          await axios.post(editMessageRoute, { messageId, newText }, getAuthHeader()); 
          socket.current.emit("edit-msg", { messageId, newText, to: currentChat._id, isGroup: !!currentChat.admin });
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, message: newText, isEdited: true } : msg));
          setEditingMessage(null);
      } catch (error) { toast.error("Failed to edit message"); }
  };

  const handleDeleteMsg = async (messageId) => {
      if(window.confirm("Delete message for everyone?")) {
          try {
              await axios.post(deleteMessageRoute, { messageId }, getAuthHeader()); 
              socket.current.emit("delete-msg", { messageId, to: currentChat._id, isGroup: !!currentChat.admin });
              setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isDeleted: true, message: "🚫 This message was deleted", reactions: [], linkMetadata: null, pollData: null } : msg));
          } catch (error) { toast.error("Failed to delete message"); }
      }
  };

  const handleReaction = async (messageId, emoji) => {
      try {
          const res = await axios.post(reactMessageRoute, { messageId, emoji, userId: currentUser._id, username: currentUser.username }, getAuthHeader());
          setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reactions: res.data.reactions } : msg));
          socket.current.emit("send-reaction", { messageId, reactions: res.data.reactions, to: currentChat._id, isGroup: !!currentChat.admin });
      } catch (e) { console.error("Failed to react", e); }
  };

  const handleOpenViewOnce = async (msgId) => {
    setMessages(prev => prev.map(m => m.id === msgId ? {...m, viewed: true, message: "💣 Media Expired"} : m));
  };

  const handleTyping = (typing) => {
    socket.current.emit("typing", { to: currentChat._id, from: currentUser._id, isTyping: typing, isGroup: !!currentChat.admin, username: currentUser.username });
  };

  const handleAddMember = async () => {
      const userId = prompt("Enter the User ID to add to this group:");
      if (userId) {
          try {
            await axios.post(addGroupMemberRoute, { groupId: currentChat._id, userId }, getAuthHeader());
            toast.success("Member added successfully");
          } catch (e) { toast.error("Failed to add member"); }
      }
  };

  const handleToggleBlock = async () => {
      try {
          await axios.post(blockUserRoute, { userId: currentUser._id, blockedUserId: currentChat._id }, getAuthHeader());
          setIsBlocked(!isBlocked);
          toast.success(isBlocked ? "User Unblocked" : "User Blocked");
      } catch (e) { toast.error("Failed to update block status"); }
  };

  // Phase 3: Scroll to specific message using Virtuoso
  const scrollToMessage = (msgId) => {
      const index = filteredMessages.findIndex(m => m.id === msgId);
      if (index !== -1) {
          virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
          setHighlightedMsgId(msgId);
          setTimeout(() => setHighlightedMsgId(null), 1500);
      }
  };

  const formatTime = (timeStr) => {
    const date = timeStr ? new Date(timeStr) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return `Last seen ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderStatusTicks = (msg) => {
    const isGroup = !!currentChat.admin;
    const handleClick = () => {
        if (isGroup) setReadReceiptsMsg(msg);
    };

    if (msg.status === "read") return <span className="tick-read" onClick={handleClick} style={{color: '#34B7F1', cursor: isGroup ? 'pointer' : 'default'}} title={isGroup ? "View read receipts" : ""}>✓✓</span>;
    if (msg.status === "delivered") return <span className="tick-delivered" onClick={handleClick} style={{cursor: isGroup ? 'pointer' : 'default'}} title={isGroup ? "View read receipts" : ""}>✓✓</span>;
    return <span className="tick-sent">✓</span>;
  };

  const renderMessageContent = (msg) => {
    if (msg.isDeleted) return <p className="deleted-text">{msg.message}</p>;
    if (msg.isViewOnce && !msg.fromSelf && !msg.viewed) return <button className="view-once-btn" onClick={() => handleOpenViewOnce(msg.id)}><FaFire /> View Once Media</button>;
    if (msg.isViewOnce && (msg.viewed || msg.message === "💣 Media Expired")) return <p className="deleted-text">💣 Media Expired</p>;

    if (msg.type === "link" && msg.linkMetadata) {
        return (
            <div className="link-preview">
                <p>{msg.message}</p>
                <a href={msg.linkMetadata.url} target="_blank" rel="noreferrer" className="preview-card">
                    {msg.linkMetadata.image && <img src={msg.linkMetadata.image} alt="preview" />}
                    <div className="preview-info">
                        <h4>{msg.linkMetadata.title}</h4>
                        <p>{msg.linkMetadata.description}</p>
                    </div>
                </a>
            </div>
        );
    }

    if (msg.type === "poll" && msg.pollData) {
        const totalVotes = msg.pollData.options.reduce((acc, opt) => acc + opt.votes.length, 0);
        return (
            <div className="poll-container">
                <h4><FaPoll/> {msg.pollData.question}</h4>
                {msg.pollData.options.map(opt => {
                    const percent = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                    const hasVoted = opt.votes.includes(currentUser._id);
                    return (
                        <div key={opt._id} className={`poll-option ${hasVoted ? 'voted' : ''}`}>
                            <div className="poll-bar" style={{width: `${percent}%`}}></div>
                            <span className="opt-text">{opt.text}</span>
                            <span className="opt-percent">{percent}%</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (msg.type === "image") return <img src={msg.message} alt="sent" className="msg-image clickable" onClick={() => setLightboxImage(msg.message)} />;
    if (msg.type === "video") return ( <video controls className="msg-video"><source src={msg.message} />Your browser does not support video playback.</video>);
    if (msg.type === "file") return ( <a href={msg.message} target="_blank" rel="noreferrer" className="msg-file-link"><FaFileDownload /> Download Attachment</a>);
    if (msg.type === "audio") return <audio controls src={msg.message} className="msg-audio" />;
    if (msg.type === "code") return ( <pre className="code-snippet"><code>{msg.message}</code></pre>);
    return <p>{msg.message}</p>;
  };

  const filteredMessages = messages.filter(msg => 
    msg.message && msg.type === "text" && msg.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Container $themeType={theme} $isCompact={isCompact} $hasPinned={!!pinnedMessage} onDragOver={handleDragOver}>
      
      {/* PHASE 2: OVERLAYS */}
      {isDragging && (
        <DropOverlay onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div className="overlay-content">
            <FaCloudUploadAlt size={80} />
            <h2>Drop files to share</h2>
            <p>Images, Videos, and Documents</p>
          </div>
        </DropOverlay>
      )}

      {/* LIGHTBOX FOR IMAGES */}
      {lightboxImage && (
        <Lightbox onClick={() => setLightboxImage(null)}>
          <button className="close-btn"><FaTimes /></button>
          <img src={lightboxImage} alt="Fullscreen" onClick={(e) => e.stopPropagation()} />
        </Lightbox>
      )}

      {/* READ RECEIPTS MODAL (GROUPS ONLY) */}
      {readReceiptsMsg && (
        <Lightbox onClick={() => setReadReceiptsMsg(null)}>
            <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn-small" onClick={() => setReadReceiptsMsg(null)}><FaTimes /></button>
                <h3>Message Info</h3>
                <div className="msg-preview">{readReceiptsMsg.message?.substring(0, 40)}...</div>
                <div className="readers-list">
                    <h4><FaCheckDouble color="#34B7F1"/> Read by</h4>
                    <div className="reader-item">
                        <div className="dot online"></div> Everyone in group
                    </div>
                </div>
            </div>
        </Lightbox>
      )}

      <div className="chat-header">
        <div className="user-details">
          <div className="header-info">
              <h3>{currentChat.name || currentChat.username} {isBlocked && <span style={{color: 'red', fontSize: '10px'}}>(Blocked)</span>}</h3>
              {!currentChat.admin && (
                  <div className="presence-info">
                      <div className={`status-dot ${isOnline ? 'online' : ''}`}></div>
                      <span className={isOnline ? "online" : ""}>
                          {isOnline ? "Online" : formatLastSeen(lastSeen)}
                      </span>
                  </div>
              )}
              {!currentChat.admin && currentChat.bio && (
                  <p className="chat-bio" title={currentChat.interests?.join(", ")}>
                      <FaInfoCircle /> {currentChat.bio}
                  </p>
              )}
          </div>

          <div className="admin-controls">
              {showSearch && (
                  <input type="text" placeholder="Search chat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="chat-search-input" />
              )}
              <FaSearch className="action-icon" title="Search messages" onClick={() => setShowSearch(!showSearch)} />
              <button className="huddle-btn"><FaMicrophoneAlt /> Start Huddle</button>
              {!currentChat.admin && (
                  <FaUserSlash className={`action-icon ${isBlocked ? 'blocked' : ''}`} title={isBlocked ? "Unblock User" : "Block User"} onClick={handleToggleBlock} />
              )}
              {currentChat.admin === currentUser._id && (
                  <>
                      <span className="admin-badge"><FaShieldAlt /> Admin</span>
                      <FaUserPlus className="action-icon" onClick={handleAddMember} title="Add Member" />
                  </>
              )}
          </div>
        </div>
      </div>
      
      {pinnedMessage && (
          <div className="pinned-banner" onClick={() => scrollToMessage(pinnedMessage.id)}>
              <FaThumbtack /> 
              <div className="pin-content">
                  <span className="pin-title">Pinned Message</span>
                  <span className="pin-text">{pinnedMessage.message.substring(0, 50)}...</span>
              </div>
          </div>
      )}

      {/* PHASE 3: VIRTUAL SCROLLING IMPLEMENTATION */}
      <div className="chat-messages-container">
        {isFetchingHistory ? (
            <div className="skeleton-container">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`message skeleton-msg ${i % 2 === 0 ? 'sended' : 'recieved'}`}>
                        <div className="content skeleton-anim" style={{width: `${Math.random() * 40 + 20}%`, height: '40px'}}/>
                    </div>
                ))}
            </div>
        ) : (
            <Virtuoso
                ref={virtuosoRef}
                className="virtuoso-scroll"
                data={filteredMessages}
                firstItemIndex={0}
                initialTopMostItemIndex={filteredMessages.length - 1}
                startReached={loadMoreMessages}
                atBottomStateChange={(bottom) => setShowScrollBtn(!bottom)}
                followOutput={(isAtBottom) => isAtBottom ? 'smooth' : false}
                components={{
                    Header: () => isLoadingMore ? <div className="loading-older"><FaSpinner className="fa-spin" /> Loading older messages...</div> : null,
                    Footer: () => isTyping ? <div className="typing-indicator"><span>{typeof isTyping === 'string' ? `${isTyping} is typing...` : "Someone is typing..."}</span></div> : <div style={{ height: '20px' }} />
                }}
                itemContent={(index, message) => (
                    <div id={`msg-${message.id}`} className={`message-wrapper ${highlightedMsgId === message.id ? 'highlight-flash' : ''}`}>
                        <div className={`message ${message.fromSelf ? "sended" : "recieved"} ${message.isDeleted ? "deleted-msg" : ""}`}>
                        <div className="content tail-physics">
                            {message.isForwarded && <div className="forwarded-tag"><FaShare /> Forwarded</div>}
                            {message.replyTo && (
                                <div className="quoted-message" onClick={() => scrollToMessage(message.replyTo.id)}>
                                    <span>{message.replyTo.isSelfQuote ? "You" : "Them"}: </span>
                                    {["text", "code"].includes(message.replyTo.type) 
                                        ? message.replyTo.text.substring(0,40) 
                                        : `[${message.replyTo.type.toUpperCase()}]`
                                    }
                                </div>
                            )}
                            {!message.fromSelf && currentChat.admin && (
                                <span className="sender-name">{message.username}</span>
                            )}
                            
                            <div className="message-payload">
                                {renderMessageContent(message)}
                            </div>

                            <div className="meta">
                                {/* Productivity UI Indicators */}
                                {message.timer && <FaClock className="timer-icon" title="Self-destructing message" />}
                                
                                <span>{formatTime(message.createdAt)}</span>
                                {message.isStarred && <FaStar className="starred-icon" color="gold" size={10} />}
                                {message.isEdited && <span className="edited-tag">(edited)</span>}
                                {message.fromSelf && !message.isDeleted && (
                                    <span className="read-status">
                                        {renderStatusTicks(message)}
                                    </span>
                                )}
                            </div>
                            {!message.isDeleted && (
                                <div className="message-actions">
                                    <button onClick={() => setReplyingTo({ id: message.id, text: message.message, type: message.type, isSelfQuote: message.fromSelf })} title="Reply"><FaReply /></button>
                                    <button title="Forward"><FaShare /></button>
                                    <button title="Star"><FaStar /></button>
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
                            {message.reactions?.length > 0 && !message.isDeleted && (
                                <div className="reactions-display">
                                    {message.reactions.map((r, i) => <span key={i} title={r.username}>{r.emoji}</span>)}
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                )}
            />
        )}
      </div>

      {showScrollBtn && (
        <ScrollButton onClick={scrollToBottom}>
            <FaArrowDown />
        </ScrollButton>
      )}
      
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

// --- KEYFRAMES ---
const popIn = keyframes`
  0% { transform: scale(0.9) translateY(10px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

const shimmer = keyframes`
  0% { background-position: -468px 0; }
  100% { background-position: 468px 0; }
`;

const pulse = keyframes`
  0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; }
`;

// --- STYLES ---
const Container = styled.div`
  display: grid; 
  grid-template-rows: ${({ $hasPinned }) => $hasPinned ? '10% auto 1fr 10%' : '10% 1fr 10%'}; 
  overflow: hidden;
  height: 100%;
  position: relative;
  
  ${({ $isCompact, $hasPinned }) => $isCompact && css`
      grid-template-rows: ${$hasPinned ? '8% auto 1fr 10%' : '8% 1fr 10%'};
  `}

  .fa-spin { animation: spin 2s infinite linear; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(359deg); } }

  .pinned-banner {
      background: rgba(0, 255, 136, 0.1); border-bottom: 1px solid rgba(0, 255, 136, 0.3);
      padding: 0.5rem 2rem; display: flex; align-items: center; gap: 1rem; color: #00ff88; cursor: pointer;
      backdrop-filter: blur(10px); z-index: 2;
      .pin-content { 
          display: flex; flex-direction: column; 
          .pin-title { font-size: 0.7rem; font-weight: bold; } 
          .pin-text { font-size: 0.85rem; color: #ccc; } 
      }
  }

  .chat-header {
    display: flex; justify-content: space-between; align-items: center; 
    padding: 0 2rem;
    background: rgba(255, 255, 255, 0.02); 
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(5px); z-index: 2;
    
    ${({ $themeType }) => $themeType === 'cyberpunk' && css`border-bottom: 1px solid #00ff88;`}
    ${({ $themeType }) => $themeType === 'midnight' && css`border-bottom: 1px solid #333;`}
    
    .user-details {
      display: flex; align-items: center; justify-content: space-between; width: 100%;
      
      .header-info {
          display: flex; flex-direction: column;
          h3 { 
              color: white; font-weight: 500; margin-bottom: 2px;
              ${({ $isCompact }) => $isCompact && css`font-size: 1rem;`} 
          }
          .presence-info {
              display: flex; align-items: center; gap: 6px; margin-top: -2px; margin-bottom: 4px;
              .status-dot {
                  width: 8px; height: 8px; border-radius: 50%; background: #555;
                  &.online { background: #00ff88; box-shadow: 0 0 5px #00ff88; }
              }
              span { font-size: 0.75rem; color: #aaa; &.online { color: #00ff88; } }
          }
          .chat-bio { font-size: 0.75rem; color: #aaa; display: flex; align-items: center; gap: 0.3rem; cursor: help; }
      }
    }
    
    .admin-controls {
        display: flex; align-items: center; gap: 1rem;
        .chat-search-input { background: rgba(0,0,0,0.3); color: white; border: 1px solid #00ff88; padding: 0.4rem 0.8rem; border-radius: 1rem; outline: none; font-size: 0.8rem; }
        .huddle-btn { background: #4e0eff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-weight: bold; transition: 0.2s; &:hover { background: #00ff88; color: black; } }
        .admin-badge { background: rgba(0, 255, 136, 0.1); color: #00ff88; padding: 0.3rem 0.6rem; border-radius: 0.5rem; border: 1px solid #00ff88; font-size: 0.7rem; font-weight: bold; display: flex; align-items: center; gap: 0.3rem; }
        .action-icon { color: #00ff88; cursor: pointer; font-size: 1.2rem; transition: 0.2s; &:hover { transform: scale(1.1); color: white; } &.blocked { color: #ff0055; } }
    }
  }

  .chat-messages-container {
    height: 100%; width: 100%; overflow: hidden; position: relative;
    padding: ${({ $isCompact }) => $isCompact ? '1rem 1.5rem' : '1.5rem 2rem'};
    
    .virtuoso-scroll { 
        height: 100% !important; width: 100% !important; 
        &::-webkit-scrollbar { width: 4px; } 
        &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 1rem; } 
    }

    .loading-older { text-align: center; padding: 1rem; color: #00ff88; font-size: 0.85rem; }
    
    .skeleton-container { display: flex; flex-direction: column; gap: 1.2rem; }
    .skeleton-msg .content { background: #2a2a35; border: none !important; border-radius: 1rem; }
    .skeleton-anim { background-image: linear-gradient(to right, #2a2a35 0%, #3a3a45 20%, #2a2a35 40%, #2a2a35 100%); background-repeat: no-repeat; background-size: 800px 100%; animation: ${shimmer} 1.5s infinite linear forwards; }

    .highlight-flash .content { animation: flashBg 1.5s ease-out; }
    @keyframes flashBg { 0% { background-color: rgba(255, 255, 255, 0.4); box-shadow: 0 0 20px rgba(255,255,255,0.5); } 100% { background-color: inherit; box-shadow: inherit; } }

    .message-wrapper { padding-bottom: 1.2rem; animation: ${popIn} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

    .message {
      display: flex; align-items: center; position: relative;
      
      .content {
        max-width: 65%;
        padding: 0.9rem 1.2rem;
        border-radius: 1.5rem;
        color: #fff; line-height: 1.4; display: flex; flex-direction: column;
        position: relative; min-width: 140px; 
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease;
        
        &:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }

        /* Perfect Design: Improved Tail Physics */
        &::before { content: ""; position: absolute; bottom: 0; width: 16px; height: 16px; z-index: -1; }

        .sender-name { font-size: 0.75rem; color: #00ff88; font-weight: bold; margin-bottom: 4px; text-transform: capitalize; }
        .deleted-text { font-style: italic; color: rgba(255,255,255,0.4); font-size: 0.9rem; }
        .edited-tag { font-size: 0.6rem; opacity: 0.5; margin-left: 5px; font-style: italic; }
        .forwarded-tag { font-size: 0.7rem; color: #aaa; margin-bottom: 0.5rem; font-style: italic; display: flex; align-items: center; gap: 0.3rem; }
        
        .view-once-btn { background: linear-gradient(90deg, #ff0055, #ff5500); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(255,0,85,0.4); }

        .link-preview {
            display: flex; flex-direction: column; gap: 0.6rem; margin: 4px 0;
            .preview-card {
                background: rgba(0,0,0,0.25); border-radius: 0.8rem; overflow: hidden; text-decoration: none; color: white; border: 1px solid rgba(255,255,255,0.1); transition: 0.2s;
                &:hover { background: rgba(0,0,0,0.4); transform: scale(1.01); }
                img { width: 100%; height: 160px; object-fit: cover; }
                .preview-info { padding: 0.8rem; h4 { margin: 0; font-size: 0.95rem; color: #00ff88; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } p { margin: 6px 0 0; font-size: 0.8rem; color: #ccc; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; } }
            }
        }

        .poll-container {
            background: rgba(0,0,0,0.2); padding: 1.2rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.1); min-width: 260px; margin: 6px 0;
            h4 { margin: 0 0 1rem 0; color: #00ff88; display: flex; align-items: center; gap: 0.6rem; font-size: 1rem; }
            .poll-option {
                position: relative; background: rgba(255,255,255,0.06); padding: 0.7rem; border-radius: 0.6rem; margin-bottom: 0.6rem; cursor: pointer; overflow: hidden; display: flex; justify-content: space-between; border: 1px solid transparent; transition: 0.2s;
                &:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); }
                &.voted { border-color: #00ff88; background: rgba(0,255,136,0.05); }
                .poll-bar { position: absolute; top: 0; left: 0; height: 100%; background: rgba(0,255,136,0.2); z-index: 0; transition: width 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .opt-text, .opt-percent { position: relative; z-index: 1; font-size: 0.9rem; font-weight: 500; }
            }
        }

        .quoted-message {
            background: rgba(0,0,0,0.25); border-left: 4px solid #00ff88; padding: 0.6rem; border-radius: 0.4rem; font-size: 0.8rem; margin-bottom: 0.6rem; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: 0.2s;
            &:hover { background: rgba(0,0,0,0.4); }
            span { font-weight: bold; color: #00ff88; }
        }

        .code-snippet { background: #1e1e1e; padding: 1rem; border-radius: 0.6rem; overflow-x: auto; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #00ff88; border: 1px solid #333; margin: 0.6rem 0; code { white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; } }
        .msg-image { max-width: 100%; border-radius: 0.8rem; margin-top: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .msg-image.clickable { cursor: pointer; transition: transform 0.2s; &:hover { transform: scale(1.02); } }
        .msg-video { max-width: 100%; border-radius: 0.8rem; margin-top: 6px; outline: none; }
        .msg-audio { max-width: 240px; margin-top: 6px; height: 40px; }
        .msg-file-link { display: flex; align-items: center; gap: 0.6rem; background: rgba(255,255,255,0.1); padding: 0.6rem 1.2rem; border-radius: 0.6rem; color: #00ff88; text-decoration: none; margin-top: 6px; font-weight: bold; font-size: 0.9rem; transition: 0.2s; &:hover { background: rgba(255,255,255,0.2); color: #fff; } }

        .meta {
            display: flex; justify-content: flex-end; align-items: center;
            gap: 6px; font-size: 0.65rem; opacity: 0.6; margin-top: 8px;
            .timer-icon { color: #ff5500; font-size: 0.75rem; }
            .read-status { font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; transition: 0.2s; }
        }

        /* Design Update: Interactive Message Actions */
        .message-actions {
            position: absolute; top: -18px; right: 10px;
            background: #1a1a25; padding: 0.4rem 0.6rem; border-radius: 2rem;
            display: flex; gap: 0.6rem; opacity: 0; visibility: hidden; 
            transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.6); z-index: 5;
            transform: translateY(10px);
            
            button, .reaction-trigger {
                background: none; border: none; color: #888; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: 0.2s; &:hover { color: #fff; transform: scale(1.1); }
            }

            .reaction-trigger:hover .reaction-menu { display: flex; }
            .reaction-menu {
                display: none; position: absolute; bottom: 130%; left: 50%;
                transform: translateX(-50%); background: #1a1a25; padding: 0.5rem;
                border-radius: 2rem; gap: 0.6rem; box-shadow: 0 4px 15px rgba(0,0,0,0.6);
                span { cursor: pointer; transition: 0.2s; font-size: 1.3rem; &:hover { transform: scale(1.4); } }
            }
        }

        &:hover .message-actions { opacity: 1; visibility: visible; transform: translateY(0); }

        .reactions-display {
            position: absolute; bottom: -14px; right: 14px;
            background: #1a1a25; padding: 0.25rem 0.6rem; border-radius: 2rem;
            font-size: 0.8rem; display: flex; gap: 0.3rem;
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
      }
    }

    .deleted-msg .content {
        background: transparent !important; border: 1px dashed rgba(255,255,255,0.2) !important; box-shadow: none !important;
        &::before { display: none; }
    }

    /* Perfect Design: Mesh Gradient & Tails for Sent */
    .sended {
      justify-content: flex-end;
      .content {
        background: linear-gradient(135deg, #4e0eff 0%, #9a41fe 100%);
        background-image: radial-gradient(at 0% 0%, #4e0eff 0, transparent 55%), 
                         radial-gradient(at 50% 0%, #9a41fe 0, transparent 55%), 
                         radial-gradient(at 100% 0%, #4e0eff 0, transparent 55%);
        border-bottom-right-radius: 0.2rem;
        box-shadow: 0 4px 20px rgba(78, 14, 255, 0.25);

        &::before { right: -7px; background: #9a41fe; clip-path: polygon(0 0, 0% 100%, 100% 100%); }
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css` background: transparent; border: 1px solid #00ff88; box-shadow: 0 0 15px rgba(0,255,136,0.15); &::before { background: #00ff88; } `}
        ${({ $themeType }) => $themeType === 'midnight' && css` background: #222; box-shadow: none; border: 1px solid #444; &::before { background: #444; } `}
      }
      .message-actions { right: auto; left: 10px; } 
      .reactions-display { right: auto; left: 14px; }
      .tail-physics { transform-origin: bottom right; }
    }

    /* Perfect Design: Glassmorphism for Received */
    .recieved {
      justify-content: flex-start;
      .content {
        background: rgba(255, 255, 255, 0.07); 
        border-bottom-left-radius: 0.2rem; 
        backdrop-filter: blur(12px); 
        border: 1px solid rgba(255,255,255,0.05);

        &::before { left: -7px; background: rgba(255, 255, 255, 0.07); clip-path: polygon(100% 0, 0 100%, 100% 100%); }
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css` background: rgba(255,0,85,0.1); border-color: #ff0055; &::before { background: #ff0055; } `}
        ${({ $themeType }) => $themeType === 'midnight' && css` background: #111; border-color: #222; &::before { background: #222; } `}
      }
      .tail-physics { transform-origin: bottom left; }
    }
    
    .typing-indicator { color: #00ff88; font-size: 0.8rem; margin-left: 2.2rem; font-style: italic; animation: ${pulse} 1.5s infinite; }
  }
`;

const DropOverlay = styled.div`
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(78, 14, 255, 0.1); backdrop-filter: blur(8px);
    z-index: 100; display: flex; justify-content: center; align-items: center;
    border: 3px dashed #4e0eff; border-radius: 2rem;
    .overlay-content { text-align: center; color: white; animation: ${popIn} 0.4s ease; h2 { margin: 1rem 0; } }
`;

const ScrollButton = styled.button`
    position: absolute; bottom: 90px; right: 30px; width: 45px; height: 45px;
    border-radius: 50%; background: #4e0eff; color: white; border: none;
    cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.4); animation: ${popIn} 0.3s ease;
    display: flex; justify-content: center; align-items: center; z-index: 10;
    &:hover { background: #6c38ff; transform: translateY(-3px); }
`;

const Lightbox = styled.div`
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.9); z-index: 1000; display: flex; justify-content: center; align-items: center;
    img { max-width: 90%; max-height: 90%; border-radius: 10px; box-shadow: 0 0 30px rgba(0,0,0,0.5); }
    .close-btn { position: absolute; top: 20px; right: 20px; background: none; border: none; color: white; font-size: 2.5rem; cursor: pointer; }
    
    .receipt-modal {
        background: #0d0d30; padding: 2rem; border-radius: 1.5rem; width: 400px;
        border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 15px 40px rgba(0,0,0,0.6); position: relative;
        color: white; animation: ${popIn} 0.3s ease;
        .close-btn-small { position: absolute; top: 15px; right: 15px; background: none; border: none; color: #aaa; cursor: pointer; font-size: 1.2rem; &:hover { color: white; } }
        h3 { margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
        .msg-preview { background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 0.5rem; font-style: italic; color: #ccc; margin-bottom: 1.5rem; }
        .readers-list {
            h4 { color: #34B7F1; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
            .reader-item { display: flex; align-items: center; gap: 0.8rem; background: rgba(255,255,255,0.05); padding: 0.8rem; border-radius: 0.5rem; .dot { width: 8px; height: 8px; border-radius: 50%; &.online { background: #00ff88; box-shadow: 0 0 5px #00ff88; } } }
        }
    }
`;