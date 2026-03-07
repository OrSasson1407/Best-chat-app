import React, { useState, useEffect, useRef } from "react";
import ChatInput from "./ChatInput";
import axios from "axios";
import { Virtuoso } from "react-virtuoso"; 
import { 
    sendMessageRoute, 
    receiveMessageRoute, 
    getGroupMessagesRoute, 
    addGroupMemberRoute,
    reactMessageRoute,
    deleteMessageRoute, 
    editMessageRoute,
    blockUserRoute,
    getChatMediaRoute // <-- ADDED: Phase 3 Media Gallery Route
} from "../utils/APIRoutes";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { 
    FaUserPlus, FaShieldAlt, FaReply, FaSmile, FaTrash, FaPen, 
    FaInfoCircle, FaFileDownload, FaShare, FaStar, FaThumbtack, 
    FaFire, FaMicrophoneAlt, FaPoll, FaSearch, FaUserSlash, FaSpinner,
    FaArrowDown, FaCloudUploadAlt, FaTimes, FaClock, FaCheckDouble,
    FaImage, FaLink // <-- ADDED: Phase 3 Icons
} from "react-icons/fa";

// --- IMPORT STYLES FROM THE NEW FILE ---
import { Container, DropOverlay, ScrollButton, Lightbox, MediaGalleryPanel } from "./ChatContainer.styles"; // <-- ADDED MediaGalleryPanel

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

  // --- PHASE 3: MEDIA GALLERY STATE ---
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [chatMedia, setChatMedia] = useState({ media: [], links: [] });
  const [activeMediaTab, setActiveMediaTab] = useState("media");
  const [isFetchingMedia, setIsFetchingMedia] = useState(false);

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
                    socket.current.emit("mark-as-read", { 
                        messageId: msg.id, 
                        from: currentUser._id, 
                        to: currentChat._id,
                        isGroup: !!currentChat.admin,
                        username: currentUser.username
                    });
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

  // Phase 3: Fetch Media Gallery Data
  useEffect(() => {
      if (showMediaGallery && currentChat) {
          const fetchMedia = async () => {
              setIsFetchingMedia(true);
              try {
                  const { data } = await axios.post(getChatMediaRoute, {
                      from: currentUser._id,
                      to: currentChat._id 
                  }, getAuthHeader());

                  if (data.status) {
                      const mediaFiles = data.media.filter(m => m.type === 'image' || m.type === 'video');
                      const linkFiles = data.media.filter(m => m.type === 'link');
                      setChatMedia({ media: mediaFiles, links: linkFiles });
                  }
              } catch (err) {
                  toast.error("Failed to load media gallery");
              } finally {
                  setIsFetchingMedia(false);
              }
          };
          fetchMedia();
      }
  }, [showMediaGallery, currentChat, currentUser]);

  // Phase 3: Virtuoso Load More Logic
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
            isStarred: false, pollData: data.pollData, linkMetadata: data.linkMetadata,
            readBy: []
        });
        s.emit("mark-as-read", { 
            messageId: data.id, 
            from: currentUser._id, 
            to: data.from,
            isGroup: !!currentChat.admin,
            username: currentUser.username
        });
      };

      const handleReactionReceive = (data) => {
          setMessages(prev => prev.map(msg => msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg));
      };

      // --- DYNAMIC READ RECEIPT HANDLERS ---
      const handleMsgReadUpdate = ({ messageId, status, newReader }) => {
          setMessages((prev) => prev.map(msg => {
              if (msg.id === messageId) {
                  const updatedReadBy = msg.readBy ? [...msg.readBy] : [];
                  if (newReader && !updatedReadBy.some(r => r.userId === newReader.userId)) {
                      updatedReadBy.push(newReader);
                  }
                  return { ...msg, status: status || msg.status, readBy: updatedReadBy };
              }
              return msg;
          }));
      };

      const handleGroupMsgReadUpdate = ({ messageId, newReader }) => {
          setMessages((prev) => prev.map(msg => {
              if (msg.id === messageId) {
                  const updatedReadBy = msg.readBy ? [...msg.readBy] : [];
                  if (newReader && !updatedReadBy.some(r => r.userId === newReader.userId)) {
                      updatedReadBy.push(newReader);
                  }
                  return { ...msg, readBy: updatedReadBy };
              }
              return msg;
          }));
          
          // Instantly update the modal if it is currently open
          if (readReceiptsMsg && readReceiptsMsg.id === messageId) {
             setReadReceiptsMsg(prev => ({
                 ...prev, 
                 readBy: prev.readBy ? [...prev.readBy, newReader] : [newReader]
             }));
          }
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
      s.on("group-msg-read-update", handleGroupMsgReadUpdate);
      s.on("msg-deleted", handleMsgDeleted);
      s.on("msg-edited", handleMsgEdited);

      return () => {
          s.off("presence-response"); s.off("user-status-change"); s.off("msg-recieve");
          s.off("receive-reaction"); s.off("msg-read-update"); s.off("group-msg-read-update");
          s.off("msg-deleted"); s.off("msg-edited");
      };
    }
  }, [socket, currentUser, currentChat, readReceiptsMsg]);

  useEffect(() => {
    if (arrivalMessage) {
        setMessages((prev) => [...prev, arrivalMessage]);
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
              pollData: payload.pollData, linkMetadata: generatedLinkData, timer: payload.timer,
              readBy: []
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

    if (msg.status === "read" || (isGroup && msg.readBy && msg.readBy.length > 0)) {
        return <span className="tick-read" onClick={handleClick} style={{color: '#34B7F1', cursor: isGroup ? 'pointer' : 'default'}} title={isGroup ? "View read receipts" : ""}>✓✓</span>;
    }
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

  // [FIX APPLIED]: Updated filter to show media files when not searching.
  const filteredMessages = messages.filter(msg => {
      // If there's no search query, show all message types
      if (!searchQuery) return true;
      
      // If the user is actively searching, only filter text/link messages
      if (msg.type !== "text" && msg.type !== "link") return false;
      
      // Perform the search
      return msg.message && msg.message.toLowerCase().includes(searchQuery.toLowerCase());
  });

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

      {/* READ RECEIPTS MODAL */}
      {readReceiptsMsg && (
        <Lightbox onClick={() => setReadReceiptsMsg(null)}>
            <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn-small" onClick={() => setReadReceiptsMsg(null)}><FaTimes /></button>
                <h3>Message Info</h3>
                <div className="msg-preview">
                    {readReceiptsMsg.message?.substring(0, 40)}
                    {readReceiptsMsg.message?.length > 40 ? "..." : ""}
                </div>
                <div className="readers-list">
                    <h4><FaCheckDouble color="#34B7F1"/> Read by ({readReceiptsMsg.readBy?.length || 0})</h4>
                    
                    {(!readReceiptsMsg.readBy || readReceiptsMsg.readBy.length === 0) ? (
                        <p style={{color: '#888', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '10px'}}>No one has read this yet.</p>
                    ) : (
                        readReceiptsMsg.readBy.map((reader, index) => (
                            <div key={index} className="reader-item">
                                <div className="reader-info">
                                    <div className="dot online"></div> 
                                    <span className="reader-name">{reader.username}</span>
                                </div>
                                <span className="reader-time">{formatTime(reader.readAt)}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Lightbox>
      )}

      {/* PHASE 3: NEW MEDIA GALLERY RIGHT PANEL */}
      {showMediaGallery && (
        <MediaGalleryPanel $themeType={theme}>
            <div className="panel-header">
                <h3>Shared Content</h3>
                <button onClick={() => setShowMediaGallery(false)} title="Close Panel"><FaTimes /></button>
            </div>
            <div className="tabs">
                <button className={activeMediaTab === 'media' ? 'active' : ''} onClick={() => setActiveMediaTab('media')}>Media</button>
                <button className={activeMediaTab === 'links' ? 'active' : ''} onClick={() => setActiveMediaTab('links')}>Links</button>
            </div>
            <div className="panel-content">
                {isFetchingMedia ? <div className="loader"><FaSpinner className="fa-spin" /></div> : (
                   activeMediaTab === 'media' ? (
                       chatMedia.media.length === 0 ? <p className="empty-state">No media shared yet.</p> :
                       <div className="media-grid">
                           {chatMedia.media.map(m => (
                               m.type === 'image' ? <img key={m.id} src={m.message} alt="shared" onClick={() => setLightboxImage(m.message)} /> :
                               <video key={m.id} src={m.message} controls />
                           ))}
                       </div>
                   ) : (
                       chatMedia.links.length === 0 ? <p className="empty-state">No links shared yet.</p> :
                       <div className="links-list">
                           {chatMedia.links.map(m => (
                               <a key={m.id} href={m.linkMetadata?.url || m.message} target="_blank" rel="noreferrer" className="link-item">
                                  <div className="link-icon"><FaLink /></div>
                                  <div className="link-info">
                                      <h4>{m.linkMetadata?.title || m.message}</h4>
                                      <p>{m.linkMetadata?.url || m.message}</p>
                                  </div>
                               </a>
                           ))}
                       </div>
                   )
                )}
            </div>
        </MediaGalleryPanel>
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
              
              {/* ADDED: MEDIA GALLERY TOGGLE BUTTON */}
              <FaImage className="action-icon" title="Media & Links" onClick={() => setShowMediaGallery(!showMediaGallery)} />
              
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