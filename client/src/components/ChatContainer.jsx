import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatInput from "./ChatInput";
import axios from "axios";
import { Virtuoso } from "react-virtuoso"; 
import { 
    host, sendMessageRoute, receiveMessageRoute, getGroupMessagesRoute, 
    addGroupMemberRoute, reactMessageRoute, deleteMessageRoute, 
    deleteMessageForMeRoute, editMessageRoute, blockUserRoute, getChatMediaRoute 
} from "../utils/APIRoutes";
import { encryptMessage, decryptMessage, encryptGroupMessage, decryptGroupMessage } from "../utils/crypto"; 
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { 
    FaThumbtack, FaSpinner, FaCloudUploadAlt, FaTimes, FaCheckDouble, FaArrowDown 
} from "react-icons/fa";

import { Container, DropOverlay, ScrollButton, Lightbox } from "./ChatContainer.styles"; 
import CallModal from "./CallModal"; 
import useChatStore from "../store/chatStore";

import ChatHeader from "./ChatHeader";
import ChatSidePanel from "./ChatSidePanel";
import MessageItem from "./MessageItem";
import { getSmallAvatar, formatTime } from "./chatHelpers";

export default function ChatContainer({ socket, isTyping }) {
  const { currentChat, currentUser, theme, isCompact } = useChatStore();

  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true); 
  
  const [activeGroupAesKey, setActiveGroupAesKey] = useState(null);

  const virtuosoRef = useRef(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  const [showSidePanel, setShowSidePanel] = useState(false);
  const [chatMedia, setChatMedia] = useState({ media: [], links: [], files: [] });
  const [activeSideTab, setActiveSideTab] = useState("about");
  const [isFetchingMedia, setIsFetchingMedia] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  
  const [unreadScrollCount, setUnreadScrollCount] = useState(0);
  const isScrolledUpRef = useRef(false);

  const [lightboxImage, setLightboxImage] = useState(null);
  const [readReceiptsMsg, setReadReceiptsMsg] = useState(null); 

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);

  const [showCallModal, setShowCallModal] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);

  const getAuthHeader = useCallback(() => ({ headers: { "x-auth-token": currentUser.token } }), [currentUser.token]);

  useEffect(() => {
      isScrolledUpRef.current = showScrollBtn;
  }, [showScrollBtn]);

  useEffect(() => {
    async function fetchHistory() {
      if (currentChat && currentUser) {
        setIsFetchingHistory(true);
        setActiveGroupAesKey(null); 
        let response;
        let decryptedAesKey = null;

        try {
            const myPrivateKeyRaw = localStorage.getItem(`privateKey_${currentUser._id}`);
            const myPrivateKey = myPrivateKeyRaw ? JSON.parse(myPrivateKeyRaw) : null;

            if (currentChat.admin) { 
                response = await axios.post(getGroupMessagesRoute, {
                    from: currentUser._id, groupId: currentChat._id,
                }, getAuthHeader());
                if (socket.current) socket.current.emit("join-group", currentChat._id);

                if (currentChat.groupKeys && myPrivateKey) {
                    const myEncryptedKeyData = currentChat.groupKeys.find(k => k.userId === currentUser._id);
                    if (myEncryptedKeyData) {
                        try {
                            const decryptedJwkString = await decryptMessage(myEncryptedKeyData.encryptedKey, myPrivateKey);
                            decryptedAesKey = JSON.parse(decryptedJwkString);
                            setActiveGroupAesKey(decryptedAesKey);
                        } catch (err) {
                            console.error("Failed to decrypt Group AES Key");
                        }
                    }
                }
            } else {
                response = await axios.post(receiveMessageRoute, {
                    from: currentUser._id, to: currentChat._id,
                }, getAuthHeader());
                setIsBlocked(currentUser.blockedUsers?.includes(currentChat._id));
            }

            const fetchedMessages = response.data.messages ? response.data.messages : response.data;
            
            const decryptedMessages = await Promise.all(fetchedMessages.map(async (msg) => {
                if (msg.type === "text" && !msg.isDeleted) {
                    if (!currentChat.admin && !msg.fromSelf && myPrivateKey) {
                        const decryptedText = await decryptMessage(msg.message, myPrivateKey);
                        return { ...msg, message: decryptedText };
                    } else if (currentChat.admin && decryptedAesKey) {
                        const decryptedGroupText = await decryptGroupMessage(msg.message, decryptedAesKey);
                        return { ...msg, message: decryptedGroupText };
                    }
                }
                return msg;
            }));

            setMessages(decryptedMessages);
            setUnreadScrollCount(0); 

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
                        messageId: msg.id, from: currentUser._id, to: currentChat._id,
                        isGroup: !!currentChat.admin, username: currentUser.username
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
  }, [currentChat, currentUser, getAuthHeader, socket]);

  useEffect(() => {
      if (showSidePanel && currentChat && (activeSideTab === 'media' || activeSideTab === 'links' || activeSideTab === 'files')) {
          const fetchMedia = async () => {
              setIsFetchingMedia(true);
              try {
                  const { data } = await axios.post(getChatMediaRoute, {
                      from: currentUser._id, to: currentChat._id, filterType: activeSideTab 
                  }, getAuthHeader());

                  if (data.status) {
                      if (activeSideTab === 'media') setChatMedia(prev => ({ ...prev, media: data.media }));
                      else if (activeSideTab === 'links') setChatMedia(prev => ({ ...prev, links: data.media }));
                      else if (activeSideTab === 'files') setChatMedia(prev => ({ ...prev, files: data.media }));
                  }
              } catch (err) {
                  toast.error("Failed to load side panel data");
              } finally {
                  setIsFetchingMedia(false);
              }
          };
          fetchMedia();
      }
  }, [showSidePanel, currentChat, currentUser, activeSideTab, getAuthHeader]);

  const loadMoreMessages = useCallback(async () => {
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
          const myPrivateKeyRaw = localStorage.getItem(`privateKey_${currentUser._id}`);
          const myPrivateKey = myPrivateKeyRaw ? JSON.parse(myPrivateKeyRaw) : null;
          
          const decryptedNewMessages = await Promise.all(newMessages.map(async (msg) => {
              if (msg.type === "text" && !msg.isDeleted) {
                  if (!currentChat.admin && !msg.fromSelf && myPrivateKey) {
                      const decryptedText = await decryptMessage(msg.message, myPrivateKey);
                      return { ...msg, message: decryptedText };
                  } else if (currentChat.admin && activeGroupAesKey) {
                      const decryptedGroupText = await decryptGroupMessage(msg.message, activeGroupAesKey);
                      return { ...msg, message: decryptedGroupText };
                  }
              }
              return msg;
          }));

          setMessages((prev) => [...decryptedNewMessages, ...prev]);
          
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
  }, [hasMore, isLoadingMore, currentChat, currentUser, cursor, activeGroupAesKey, getAuthHeader]);

  const scrollToBottom = useCallback(() => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
      setUnreadScrollCount(0); 
  }, [messages.length]);

  // IMPROVEMENT: Fixed dependency array to use socket.current
  useEffect(() => {
      if (socket.current && currentUser) {
          const s = socket.current;
          const heartbeatInterval = setInterval(() => s.emit("heartbeat", currentUser._id), 30000); 
          return () => clearInterval(heartbeatInterval);
      }
  }, [socket, currentUser]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) toast.info(`Preparing to upload ${files[0].name}...`);
  };

  // IMPROVEMENT: Removed readReceiptsMsg from dependencies to prevent socket unbinding
  useEffect(() => {
    if (socket.current) {
      const s = socket.current;
      if (currentChat && !currentChat.admin) s.emit("check-presence", currentChat._id);

      const handlePresenceResponse = (data) => {
        if (data.userId === currentChat._id) { setIsOnline(data.isOnline); setLastSeen(data.lastSeen); }
      };

      const handleMsgRecieve = async (data) => {
        let decryptedText = data.msg;
        if (data.type === "text") {
            if (!data.isGroup) {
                const myPrivateKeyRaw = localStorage.getItem(`privateKey_${currentUser._id}`);
                const myPrivateKey = myPrivateKeyRaw ? JSON.parse(myPrivateKeyRaw) : null;
                if (myPrivateKey) {
                    decryptedText = await decryptMessage(data.msg, myPrivateKey);
                }
            } else if (data.isGroup && activeGroupAesKey) {
                decryptedText = await decryptGroupMessage(data.msg, activeGroupAesKey);
            }
        }

        setArrivalMessage({ 
            id: data.id, fromSelf: false, message: decryptedText, type: data.type, 
            createdAt: data.createdAt, username: data.username, replyTo: data.replyTo,
            reactions: [], status: "delivered", isDeleted: false, isEdited: false,
            isForwarded: data.isForwarded, isViewOnce: data.isViewOnce, viewed: false,
            isStarred: false, pollData: data.pollData, linkMetadata: data.linkMetadata,
            fileMetadata: data.fileMetadata, readBy: []
        });
        
        s.emit("mark-as-read", { 
            messageId: data.id, from: currentUser._id, to: data.from,
            isGroup: !!currentChat.admin, username: currentUser.username
        });
      };

      const handleReactionReceive = (data) => setMessages(prev => prev.map(msg => msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg));
      
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
          
          // Use functional state update so we don't need readReceiptsMsg in the dependency array
          setReadReceiptsMsg(prev => {
             if (prev && prev.id === messageId) {
                 return { ...prev, readBy: prev.readBy ? [...prev.readBy, newReader] : [newReader] };
             }
             return prev;
          });
      };

      const handleMsgDeleted = ({ messageId }) => setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isDeleted: true, message: "🚫 This message was deleted", reactions: [] } : msg));
      const handleMsgEdited = ({ messageId, newText }) => setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isEdited: true, message: newText } : msg));

      const handleIncomingCall = (data) => {
          setIncomingCallData(data);
          setShowCallModal(true);
      };

      s.on("presence-response", handlePresenceResponse);
      s.on("user-status-change", handlePresenceResponse);
      s.on("msg-recieve", handleMsgRecieve);
      s.on("receive-reaction", handleReactionReceive);
      s.on("msg-read-update", handleMsgReadUpdate);
      s.on("group-msg-read-update", handleGroupMsgReadUpdate);
      s.on("msg-deleted", handleMsgDeleted);
      s.on("msg-edited", handleMsgEdited);
      s.on("incoming-call", handleIncomingCall);

      return () => {
          s.off("presence-response"); s.off("user-status-change"); s.off("msg-recieve");
          s.off("receive-reaction"); s.off("msg-read-update"); s.off("group-msg-read-update");
          s.off("msg-deleted"); s.off("msg-edited"); s.off("incoming-call"); 
      };
    }
  }, [socket, currentUser, currentChat, activeGroupAesKey]);

  useEffect(() => {
    if (arrivalMessage) {
        setMessages((prev) => [...prev, arrivalMessage]);
        if (isScrolledUpRef.current) {
            setUnreadScrollCount(prev => prev + 1);
        }
    }
  }, [arrivalMessage]);

  // IMPROVEMENT: Wrapped in useCallback
  const handleSendMsg = useCallback(async (msg, type = "text", replyToId = null, extraData = {}) => {
    const time = new Date().toISOString();
    let finalMessageContent = msg;
    const newMessageId = uuidv4(); 

    try {
        if (type === "text") {
            if (!currentChat.admin) {
                try {
                    const pkResponse = await axios.get(`${host}/api/auth/publickey/${currentChat._id}`, getAuthHeader());
                    const receiverPublicKey = pkResponse.data.publicKey;
                    if (receiverPublicKey) {
                        finalMessageContent = await encryptMessage(msg, receiverPublicKey);
                    }
                } catch (err) {
                    console.error("Could not fetch public key for encryption");
                }
            } else if (currentChat.admin && activeGroupAesKey) {
                finalMessageContent = await encryptGroupMessage(msg, activeGroupAesKey);
            }
        }

        const payload = {
            from: currentUser._id, to: currentChat._id, message: finalMessageContent, 
            type, replyTo: replyToId, isForwarded: extraData.isForwarded || false,
            isViewOnce: extraData.isViewOnce || false, pollData: extraData.pollData || null,
            timer: extraData.timer || null, fileName: extraData.fileName || null, fileSize: extraData.fileSize || null  
        };

        const fileMetadataObj = extraData.fileName ? { fileName: extraData.fileName, fileSize: extraData.fileSize } : null;

        const socketData = {
            id: newMessageId, to: currentChat._id, from: currentUser._id, 
            msg: finalMessageContent, type: type, isGroup: !!currentChat.admin, 
            username: currentUser.username, 
            replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, type: replyingTo.type, isSelfQuote: replyingTo.isSelfQuote } : null,
            ...payload, linkMetadata: null, fileMetadata: fileMetadataObj 
        };
        
        setMessages((prev) => [
            ...prev, 
            { 
              id: newMessageId, fromSelf: true, message: msg, type: type, createdAt: time, 
              replyTo: socketData.replyTo, reactions: [], status: "pending", isDeleted: false, isEdited: false,
              isForwarded: payload.isForwarded, isViewOnce: payload.isViewOnce, viewed: false, 
              pollData: payload.pollData, linkMetadata: null, timer: payload.timer,
              fileMetadata: fileMetadataObj, readBy: []
            }
        ]);
        setReplyingTo(null); 

        const res = await axios.post(sendMessageRoute, payload, getAuthHeader());
        const generatedLinkData = res.data.data?.linkMetadata || null;
        socketData.linkMetadata = generatedLinkData;

        socket.current.emit("send-msg", socketData, (response) => {
            if (response && response.status) {
                setMessages((prev) => prev.map(m => m.id === newMessageId ? { 
                    ...m, status: response.status, linkMetadata: generatedLinkData 
                } : m));
            }
        });

    } catch (error) {
        if (error.response && error.response.status === 403) toast.error(error.response.data.msg || "You are blocked.");
        else toast.error("Failed to send message");
        setMessages((prev) => prev.filter(m => m.id !== newMessageId));
    }
  }, [currentChat, currentUser, activeGroupAesKey, replyingTo, getAuthHeader, socket]);

  // IMPROVEMENT: Wrapped in useCallback
  const handleEditMsgSubmit = useCallback(async (messageId, newText) => {
      try {
          await axios.post(editMessageRoute, { messageId, newText }, getAuthHeader()); 
          socket.current.emit("edit-msg", { messageId, newText, to: currentChat._id, isGroup: !!currentChat.admin });
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, message: newText, isEdited: true } : msg));
          setEditingMessage(null);
      } catch (error) { toast.error("Failed to edit message"); }
  }, [currentChat, getAuthHeader, socket]);

  // IMPROVEMENT: Wrapped in useCallback
  const handleDeleteMsg = useCallback(async (messageId, fromSelf) => {
      const options = fromSelf ? "Press OK to 'Delete for Everyone', or Cancel to 'Delete for Me'." : "Delete this message for yourself?";
      const deleteForEveryone = fromSelf ? window.confirm(options) : false;

      try {
          if (deleteForEveryone) {
              await axios.post(deleteMessageRoute, { messageId }, getAuthHeader()); 
              socket.current.emit("delete-msg", { messageId, to: currentChat._id, isGroup: !!currentChat.admin });
              setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isDeleted: true, message: "🚫 This message was deleted", reactions: [], linkMetadata: null, pollData: null } : msg));
          } else {
              const confirmDeleteForMe = fromSelf ? window.confirm("Delete for me then?") : window.confirm(options);
              if (confirmDeleteForMe) {
                  await axios.post(deleteMessageForMeRoute, { messageId, userId: currentUser._id }, getAuthHeader());
                  setMessages((prev) => prev.filter(msg => msg.id !== messageId));
                  toast.success("Message deleted for you");
              }
          }
      } catch (error) { toast.error("Failed to delete message"); }
  }, [currentChat, currentUser, getAuthHeader, socket]);

  // IMPROVEMENT: Wrapped in useCallback
  const handleReaction = useCallback(async (messageId, emoji) => {
      try {
          const res = await axios.post(reactMessageRoute, { messageId, emoji, userId: currentUser._id, username: currentUser.username }, getAuthHeader());
          setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reactions: res.data.reactions } : msg));
          socket.current.emit("send-reaction", { messageId, reactions: res.data.reactions, to: currentChat._id, isGroup: !!currentChat.admin });
      } catch (e) { console.error("Failed to react", e); }
  }, [currentChat, currentUser, getAuthHeader, socket]);

  // IMPROVEMENT: Wrapped in useCallback
  const handleOpenViewOnce = useCallback(async (msgId) => {
    setMessages(prev => prev.map(m => m.id === msgId ? {...m, viewed: true, message: "💣 Media Expired"} : m));
  }, []);

  const handleTyping = useCallback((typing) => {
    socket.current.emit("typing", { to: currentChat._id, from: currentUser._id, isTyping: typing, isGroup: !!currentChat.admin, username: currentUser.username });
  }, [currentChat, currentUser, socket]);

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

  const filteredMessages = messages.filter(msg => {
      if (!searchQuery) return true;
      if (msg.type !== "text" && msg.type !== "link") return false;
      return msg.message && msg.message.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // IMPROVEMENT: Wrapped in useCallback
  const scrollToMessage = useCallback((msgId) => {
      const index = filteredMessages.findIndex(m => m.id === msgId);
      if (index !== -1) {
          virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
          setHighlightedMsgId(msgId);
          setTimeout(() => setHighlightedMsgId(null), 1500);
      }
  }, [filteredMessages]);

  return (
    <Container $themeType={theme} $isCompact={isCompact} $hasPinned={!!pinnedMessage} onDragOver={handleDragOver}>
      
      {isDragging && (
        <DropOverlay onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div className="overlay-content">
            <FaCloudUploadAlt size={80} />
            <h2>Drop files to share</h2>
            <p>Images, Videos, and Documents</p>
          </div>
        </DropOverlay>
      )}

      {showCallModal && (
          <CallModal socket={socket} currentUser={currentUser} currentChat={currentChat} incomingCallData={incomingCallData} closeModal={() => { setShowCallModal(false); setIncomingCallData(null); }} />
      )}

      {lightboxImage && (
        <Lightbox onClick={() => setLightboxImage(null)}>
          <button className="close-btn"><FaTimes /></button>
          <img src={lightboxImage} alt="Fullscreen" onClick={(e) => e.stopPropagation()} />
        </Lightbox>
      )}

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
                                    <img src={getSmallAvatar(reader.username)} alt="avatar" className="reader-avatar-img" />
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

      {showSidePanel && (
        <ChatSidePanel 
            theme={theme} currentChat={currentChat} isOnline={isOnline} lastSeen={lastSeen}
            activeSideTab={activeSideTab} setActiveSideTab={setActiveSideTab}
            setShowSidePanel={setShowSidePanel} isFetchingMedia={isFetchingMedia}
            chatMedia={chatMedia} setLightboxImage={setLightboxImage}
        />
      )}

      <ChatHeader 
          currentChat={currentChat} currentUser={currentUser} isBlocked={isBlocked}
          isOnline={isOnline} lastSeen={lastSeen} showSearch={showSearch} 
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
          setShowSearch={setShowSearch} showSidePanel={showSidePanel} 
          setShowSidePanel={setShowSidePanel} setActiveSideTab={setActiveSideTab} 
          handleToggleBlock={handleToggleBlock} handleAddMember={handleAddMember} 
          setIncomingCallData={setIncomingCallData} setShowCallModal={setShowCallModal}
      />
      
      {pinnedMessage && (
          <div className="pinned-banner" onClick={() => scrollToMessage(pinnedMessage.id)}>
              <FaThumbtack /> 
              <div className="pin-content">
                  <span className="pin-title">Pinned Message</span>
                  <span className="pin-text">{pinnedMessage.message.substring(0, 50)}...</span>
              </div>
          </div>
      )}

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
                ref={virtuosoRef} className="virtuoso-scroll" data={filteredMessages} firstItemIndex={0}
                initialTopMostItemIndex={filteredMessages.length - 1} startReached={loadMoreMessages}
                atBottomStateChange={(bottom) => {
                    setShowScrollBtn(!bottom);
                    if (bottom) setUnreadScrollCount(0); 
                }}
                followOutput={(isAtBottom) => isAtBottom ? 'smooth' : false}
                components={{
                    Header: () => isLoadingMore ? <div className="loading-older"><FaSpinner className="fa-spin" /> Loading older messages...</div> : null,
                    Footer: () => isTyping ? (
                        <div className="message-wrapper" style={{ paddingBottom: '10px' }}>
                            <div className="message recieved typing-msg">
                                <div className="content tail-physics" style={{ minWidth: '60px', padding: '0.8rem 1.2rem' }}>
                                    {typeof isTyping === 'string' && currentChat.admin && (
                                        <span className="sender-name" style={{ marginBottom: '2px' }}>{isTyping}</span>
                                    )}
                                    <div className="typing-dots">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : <div style={{ height: '20px' }} />
                }}
                itemContent={(index, message) => (
                    <MessageItem 
                        message={message} prevMsg={index > 0 ? filteredMessages[index - 1] : null}
                        nextMsg={index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null}
                        currentChat={currentChat} currentUser={currentUser} searchQuery={searchQuery}
                        highlightedMsgId={highlightedMsgId} setLightboxImage={setLightboxImage}
                        setReadReceiptsMsg={setReadReceiptsMsg} scrollToMessage={scrollToMessage}
                        setReplyingTo={setReplyingTo} setEditingMessage={setEditingMessage}
                        handleDeleteMsg={handleDeleteMsg} handleReaction={handleReaction} handleOpenViewOnce={handleOpenViewOnce}
                    />
                )}
            />
        )}
      </div>

      {showScrollBtn && (
        <ScrollButton onClick={scrollToBottom}>
            <FaArrowDown />
            {unreadScrollCount > 0 && (
                <span className="unread-badge">
                    {unreadScrollCount > 99 ? '99+' : unreadScrollCount}
                </span>
            )}
        </ScrollButton>
      )}
      
      <ChatInput 
          handleSendMsg={handleSendMsg} handleTyping={handleTyping} 
          replyingTo={replyingTo} setReplyingTo={setReplyingTo} 
          editingMessage={editingMessage} setEditingMessage={setEditingMessage}
          handleEditMsgSubmit={handleEditMsgSubmit}
      />
    </Container>
  );
}