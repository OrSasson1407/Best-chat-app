import React, { useState, useEffect, useRef } from "react";
import ChatInput from "./ChatInput";
import axios from "axios";
import { Virtuoso } from "react-virtuoso"; 
import { 
    host, 
    sendMessageRoute, 
    receiveMessageRoute, 
    getGroupMessagesRoute, 
    addGroupMemberRoute,
    reactMessageRoute,
    deleteMessageRoute, 
    deleteMessageForMeRoute, 
    editMessageRoute,
    blockUserRoute,
    getChatMediaRoute 
} from "../utils/APIRoutes";

// --- MERGE UPDATE: Import AES Group Crypto Functions ---
import { encryptMessage, decryptMessage, encryptGroupMessage, decryptGroupMessage } from "../utils/crypto"; 
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { 
    FaUserPlus, FaShieldAlt, FaReply, FaSmile, FaTrash, FaPen, 
    FaInfoCircle, FaFileDownload, FaShare, FaStar, FaThumbtack, 
    FaFire, FaMicrophoneAlt, FaPoll, FaSearch, FaUserSlash, FaSpinner,
    FaArrowDown, FaCloudUploadAlt, FaTimes, FaClock, FaCheckDouble,
    FaImage, FaLink, FaRegClock 
} from "react-icons/fa";

import { Container, DropOverlay, ScrollButton, Lightbox, SideInfoPanel } from "./ChatContainer.styles"; 
import CallModal from "./CallModal"; 
import useChatStore from "../store/chatStore";

// Helper for tiny avatars
const getSmallAvatar = (seed) => {
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
};

// --- TIMELINE & GROUPING HELPERS ---
const isNewDay = (currentDate, previousDate) => {
    if (!previousDate) return true;
    const d1 = new Date(currentDate);
    const d2 = new Date(previousDate);
    return d1.toDateString() !== d2.toDateString();
};

const formatDateBadge = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const isSameSender = (msg1, msg2) => {
    if (!msg1 || !msg2) return false;
    return msg1.fromSelf === msg2.fromSelf && msg1.username === msg2.username;
};

const isWithinTimeFrame = (msg1, msg2) => {
    if (!msg1 || !msg2) return false;
    const t1 = new Date(msg1.createdAt).getTime();
    const t2 = new Date(msg2.createdAt).getTime();
    return Math.abs(t1 - t2) < 5 * 60 * 1000; 
};

const HighlightedText = ({ text, query }) => {
    if (!query) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
        <span>
            {parts.map((part, i) => 
                part.toLowerCase() === query.toLowerCase() ? 
                <mark key={i} className="search-highlight">{part}</mark> : part
            )}
        </span>
    );
};

export default function ChatContainer({ socket, isTyping }) {
  
  const { currentChat, currentUser, theme, isCompact } = useChatStore();

  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true); 
  
  // --- MERGE UPDATE: STATE FOR DECRYPTED GROUP AES KEY ---
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

  const getAuthHeader = () => ({
    headers: { "x-auth-token": currentUser.token },
  });

  useEffect(() => {
      isScrolledUpRef.current = showScrollBtn;
  }, [showScrollBtn]);

  useEffect(() => {
    async function fetchHistory() {
      if (currentChat && currentUser) {
        setIsFetchingHistory(true);
        setActiveGroupAesKey(null); // Reset key on chat change
        let response;
        let decryptedAesKey = null;

        try {
            const myPrivateKeyRaw = localStorage.getItem(`privateKey_${currentUser._id}`);
            const myPrivateKey = myPrivateKeyRaw ? JSON.parse(myPrivateKeyRaw) : null;

            if (currentChat.admin) { 
                response = await axios.post(getGroupMessagesRoute, {
                    from: currentUser._id,
                    groupId: currentChat._id,
                }, getAuthHeader());
                if (socket.current) socket.current.emit("join-group", currentChat._id);

                // --- MERGE UPDATE: FETCH & DECRYPT GROUP AES KEY ---
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
                    from: currentUser._id,
                    to: currentChat._id,
                }, getAuthHeader());
                setIsBlocked(currentUser.blockedUsers?.includes(currentChat._id));
            }

            const fetchedMessages = response.data.messages ? response.data.messages : response.data;
            
            // --- MERGE UPDATE: E2EE DECRYPTION FOR HISTORY (BOTH 1v1 AND GROUP) ---
            const decryptedMessages = await Promise.all(fetchedMessages.map(async (msg) => {
                if (msg.type === "text" && !msg.isDeleted) {
                    if (!currentChat.admin && !msg.fromSelf && myPrivateKey) {
                        // 1-on-1 Asymmetric Decryption
                        const decryptedText = await decryptMessage(msg.message, myPrivateKey);
                        return { ...msg, message: decryptedText };
                    } else if (currentChat.admin && decryptedAesKey) {
                        // Group Symmetric Decryption
                        const decryptedGroupText = await decryptGroupMessage(msg.message, decryptedAesKey);
                        return { ...msg, message: decryptedGroupText };
                    }
                }
                return msg;
            }));

            setMessages(decryptedMessages);
            // --------------------------------------------------------

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

  useEffect(() => {
      if (showSidePanel && currentChat && (activeSideTab === 'media' || activeSideTab === 'links' || activeSideTab === 'files')) {
          const fetchMedia = async () => {
              setIsFetchingMedia(true);
              try {
                  const { data } = await axios.post(getChatMediaRoute, {
                      from: currentUser._id,
                      to: currentChat._id,
                      filterType: activeSideTab 
                  }, getAuthHeader());

                  if (data.status) {
                      if (activeSideTab === 'media') {
                          setChatMedia(prev => ({ ...prev, media: data.media }));
                      } else if (activeSideTab === 'links') {
                          setChatMedia(prev => ({ ...prev, links: data.media }));
                      } else if (activeSideTab === 'files') {
                          setChatMedia(prev => ({ ...prev, files: data.media }));
                      }
                  }
              } catch (err) {
                  toast.error("Failed to load side panel data");
              } finally {
                  setIsFetchingMedia(false);
              }
          };
          fetchMedia();
      }
  }, [showSidePanel, currentChat, currentUser, activeSideTab]);

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
          
          const myPrivateKeyRaw = localStorage.getItem(`privateKey_${currentUser._id}`);
          const myPrivateKey = myPrivateKeyRaw ? JSON.parse(myPrivateKeyRaw) : null;
          
          // --- MERGE UPDATE: Decrypt older messages using proper Group vs 1v1 keys ---
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
  };

  const scrollToBottom = () => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
      setUnreadScrollCount(0); 
  };

  useEffect(() => {
      if (socket.current && currentUser) {
          const heartbeatInterval = setInterval(() => {
              socket.current.emit("heartbeat", currentUser._id);
          }, 30000); 
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

  useEffect(() => {
    if (socket.current) {
      const s = socket.current;
      if (currentChat && !currentChat.admin) s.emit("check-presence", currentChat._id);

      const handlePresenceResponse = (data) => {
        if (data.userId === currentChat._id) { setIsOnline(data.isOnline); setLastSeen(data.lastSeen); }
      };

      const handleMsgRecieve = async (data) => {
        // --- MERGE UPDATE: E2EE DECRYPTION ON REAL-TIME RECEIVE (Group & 1v1) ---
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
            fileMetadata: data.fileMetadata, 
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
          s.off("msg-deleted"); s.off("msg-edited");
          s.off("incoming-call"); 
      };
    }
  }, [socket, currentUser, currentChat, readReceiptsMsg, activeGroupAesKey]);

  useEffect(() => {
    if (arrivalMessage) {
        setMessages((prev) => [...prev, arrivalMessage]);
        if (isScrolledUpRef.current) {
            setUnreadScrollCount(prev => prev + 1);
        }
    }
  }, [arrivalMessage]);

  const handleSendMsg = async (msg, type = "text", replyToId = null, extraData = {}) => {
    const time = new Date().toISOString();
    let finalMessageContent = msg;
    const newMessageId = uuidv4(); 

    try {
        // --- MERGE UPDATE: SENDING GROUP ENCRYPTED MESSAGES ---
        if (type === "text") {
            if (!currentChat.admin) {
                // 1v1 RSA Encryption
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
                // Group AES Encryption
                finalMessageContent = await encryptGroupMessage(msg, activeGroupAesKey);
            }
        }

        const payload = {
            from: currentUser._id, 
            to: currentChat._id, 
            message: finalMessageContent, 
            type,
            replyTo: replyToId, 
            isForwarded: extraData.isForwarded || false,
            isViewOnce: extraData.isViewOnce || false, 
            pollData: extraData.pollData || null,
            timer: extraData.timer || null,
            fileName: extraData.fileName || null, 
            fileSize: extraData.fileSize || null  
        };

        const fileMetadataObj = extraData.fileName ? { fileName: extraData.fileName, fileSize: extraData.fileSize } : null;

        const socketData = {
            id: newMessageId, 
            to: currentChat._id, 
            from: currentUser._id, 
            msg: finalMessageContent, 
            type: type, 
            isGroup: !!currentChat.admin, 
            username: currentUser.username, 
            replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, type: replyingTo.type, isSelfQuote: replyingTo.isSelfQuote } : null,
            ...payload, 
            linkMetadata: null,
            fileMetadata: fileMetadataObj 
        };
        
        setMessages((prev) => [
            ...prev, 
            { 
              id: newMessageId, fromSelf: true, message: msg, type: type, createdAt: time, 
              replyTo: socketData.replyTo, reactions: [], status: "pending", isDeleted: false, isEdited: false,
              isForwarded: payload.isForwarded, isViewOnce: payload.isViewOnce, viewed: false, 
              pollData: payload.pollData, linkMetadata: null, timer: payload.timer,
              fileMetadata: fileMetadataObj, 
              readBy: []
            }
        ]);
        setReplyingTo(null); 

        const res = await axios.post(sendMessageRoute, payload, getAuthHeader());
        const generatedLinkData = res.data.data?.linkMetadata || null;
        socketData.linkMetadata = generatedLinkData;

        socket.current.emit("send-msg", socketData, (response) => {
            if (response && response.status) {
                setMessages((prev) => prev.map(m => m.id === newMessageId ? { 
                    ...m, 
                    status: response.status, 
                    linkMetadata: generatedLinkData 
                } : m));
            }
        });

    } catch (error) {
        if (error.response && error.response.status === 403) toast.error(error.response.data.msg || "You are blocked.");
        else toast.error("Failed to send message");
        setMessages((prev) => prev.filter(m => m.id !== newMessageId));
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

  const handleDeleteMsg = async (messageId, fromSelf) => {
      const options = fromSelf 
          ? "Press OK to 'Delete for Everyone', or Cancel to 'Delete for Me'."
          : "Delete this message for yourself?";

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

    const hasReaders = isGroup && msg.readBy && msg.readBy.length > 0;

    return (
        <span className={`read-status-wrapper ${hasReaders ? 'has-avatars' : ''}`} onClick={handleClick} title={isGroup ? "View read receipts" : ""}>
            {hasReaders && (
                <div className="reader-avatars">
                    {msg.readBy.slice(0, 3).map((reader, idx) => (
                        <img key={idx} src={getSmallAvatar(reader.username)} alt={reader.username} className="tiny-avatar" style={{ zIndex: 3 - idx }} />
                    ))}
                    {msg.readBy.length > 3 && <span className="more-readers">+{msg.readBy.length - 3}</span>}
                </div>
            )}
            
            {msg.status === "pending" ? (
                <span className="tick-pending" style={{color: '#888', opacity: 0.7}}><FaRegClock size={11}/></span>
            ) : (msg.status === "read" || hasReaders) ? (
                <span className="tick-read" style={{color: '#34B7F1', cursor: isGroup ? 'pointer' : 'default'}}>✓✓</span>
            ) : msg.status === "delivered" ? (
                <span className="tick-delivered" style={{cursor: isGroup ? 'pointer' : 'default'}}>✓✓</span>
            ) : (
                <span className="tick-sent">✓</span>
            )}
        </span>
    );
  };

  const renderMessageContent = (msg) => {
    if (msg.isDeleted) return <p className="deleted-text">{msg.message}</p>;
    if (msg.isViewOnce && !msg.fromSelf && !msg.viewed) return <button className="view-once-btn" onClick={() => handleOpenViewOnce(msg.id)}><FaFire /> View Once Media</button>;
    if (msg.isViewOnce && (msg.viewed || msg.message === "💣 Media Expired")) return <p className="deleted-text">💣 Media Expired</p>;

    if (msg.type === "text") return <p><HighlightedText text={msg.message} query={searchQuery}/></p>;

    if (msg.type === "link" && msg.linkMetadata) {
        return (
            <div className="link-preview">
                <p><HighlightedText text={msg.message} query={searchQuery}/></p>
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
    
    if (msg.type === "file") {
        const fName = msg.fileMetadata?.fileName || "Attachment";
        const fSize = msg.fileMetadata?.fileSize || "";
        return ( 
            <a href={msg.message} target="_blank" rel="noreferrer" className="msg-file-link">
                <div className="file-icon"><FaFileDownload /></div>
                <div className="file-details">
                    <span className="fname">{fName}</span>
                    {fSize && <span className="fsize">{fSize}</span>}
                </div>
            </a>
        );
    }
    if (msg.type === "audio") {
        return (
            <div className="audio-player-wrapper">
                <audio controls src={msg.message} className="msg-audio" />
            </div>
        );
    }

    if (msg.type === "code") return ( <pre className="code-snippet"><code>{msg.message}</code></pre>);
    return <p>{msg.message}</p>;
  };

  const filteredMessages = messages.filter(msg => {
      if (!searchQuery) return true;
      if (msg.type !== "text" && msg.type !== "link") return false;
      return msg.message && msg.message.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
          <CallModal 
              socket={socket}
              currentUser={currentUser}
              currentChat={currentChat}
              incomingCallData={incomingCallData}
              closeModal={() => {
                  setShowCallModal(false);
                  setIncomingCallData(null);
              }}
          />
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
        <SideInfoPanel $themeType={theme}>
            <div className="panel-header">
                <h3>{activeSideTab === 'about' ? 'Contact Details' : 'Shared Content'}</h3>
                <button onClick={() => setShowSidePanel(false)}><FaTimes /></button>
            </div>
            <div className="tabs">
                <button className={activeSideTab === 'about' ? 'active' : ''} onClick={() => setActiveSideTab('about')}>About</button>
                <button className={activeSideTab === 'media' ? 'active' : ''} onClick={() => setActiveSideTab('media')}>Media</button>
                <button className={activeSideTab === 'links' ? 'active' : ''} onClick={() => setActiveSideTab('links')}>Links</button>
                <button className={activeSideTab === 'files' ? 'active' : ''} onClick={() => setActiveSideTab('files')}>Files</button>
            </div>
            <div className="panel-content">
                {activeSideTab === 'about' ? (
                    <div className="about-section">
                        <div className="profile-hero">
                             <img src={currentChat.avatarImage ? `https://avatar.iran.liara.run/public/${currentChat.avatarImage}` : getSmallAvatar(currentChat.username)} alt="hero" />
                             <h3>{currentChat.username}</h3>
                             <p className="presence">{isOnline ? "Online Now" : formatLastSeen(lastSeen)}</p>
                        </div>
                        <div className="info-card">
                            <label>Bio</label>
                            <p>{currentChat.bio || "No bio available."}</p>
                        </div>
                        <div className="info-card">
                            <label>Interests</label>
                            <div className="interests-grid">
                                {currentChat.interests?.length > 0 ? currentChat.interests.map((i, idx) => <span key={idx} className="interest-tag">{i}</span>) : <span>No interests listed.</span>}
                            </div>
                        </div>
                    </div>
                ) : (
                    isFetchingMedia ? <div className="loader"><FaSpinner className="fa-spin" /></div> : (
                       activeSideTab === 'media' ? (
                           chatMedia.media.length === 0 ? <p className="empty-state">No media shared yet.</p> :
                           <div className="media-grid">
                               {chatMedia.media.map(m => (
                                   m.type === 'image' ? <img key={m.id} src={m.message} alt="shared" onClick={() => setLightboxImage(m.message)} /> :
                                   <video key={m.id} src={m.message} controls />
                               ))}
                           </div>
                       ) : activeSideTab === 'links' ? (
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
                       ) : (
                           chatMedia.files?.length === 0 ? <p className="empty-state">No files shared yet.</p> :
                           <div className="links-list">
                               {chatMedia.files?.map(m => (
                                   <a key={m.id} href={m.message} target="_blank" rel="noreferrer" className="link-item">
                                      <div className="link-icon"><FaFileDownload /></div>
                                      <div className="link-info">
                                          <h4>{m.fileMetadata?.fileName || "Attachment"}</h4>
                                          <p>{m.fileMetadata?.fileSize || "Unknown Size"}</p>
                                      </div>
                                   </a>
                               ))}
                           </div>
                       )
                    )
                )}
            </div>
        </SideInfoPanel>
      )}

      <div className="chat-header">
        <div className="user-details">
          <div className="header-info" onClick={() => { setShowSidePanel(true); setActiveSideTab('about'); }} style={{cursor: 'pointer'}}>
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
              <FaInfoCircle className="action-icon" title="Contact Info & Media" onClick={() => { setShowSidePanel(!showSidePanel); setActiveSideTab('about'); }} />
              
              <button 
                  className="huddle-btn" 
                  onClick={() => {
                      setIncomingCallData(null); 
                      setShowCallModal(true);
                  }}
              >
                  <FaMicrophoneAlt /> Start Huddle
              </button>

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
                itemContent={(index, message) => {
                    const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                    const nextMsg = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null;
                    
                    const showDateSeparator = isNewDay(message.createdAt, prevMsg?.createdAt);
                    
                    const isGroupedWithPrev = prevMsg && 
                                              isSameSender(message, prevMsg) && 
                                              isWithinTimeFrame(message, prevMsg) && 
                                              !showDateSeparator;

                    const isGroupedWithNext = nextMsg && 
                                              isSameSender(message, nextMsg) && 
                                              isWithinTimeFrame(message, nextMsg) && 
                                              !isNewDay(nextMsg.createdAt, message.createdAt);

                    return (
                        <div key={message.id}>
                            {showDateSeparator && (
                                <div className="date-separator">
                                    <span>{formatDateBadge(message.createdAt)}</span>
                                </div>
                            )}
                            
                            <div 
                                id={`msg-${message.id}`} 
                                className={`message-wrapper ${highlightedMsgId === message.id ? 'highlight-flash' : ''} ${isGroupedWithNext ? 'grouped-next' : ''} ${isGroupedWithPrev ? 'grouped-prev' : ''}`}
                            >
                                <div className={`message ${message.fromSelf ? "sended" : "recieved"} ${message.isDeleted ? "deleted-msg" : ""}`}>
                                <div className="content tail-physics">
                                    {message.isForwarded && <div className="forwarded-tag"><FaShare /> Forwarded</div>}
                                    
                                    {message.replyTo && typeof message.replyTo === 'object' && (
                                        <div className="quoted-message" onClick={() => scrollToMessage(message.replyTo.id)}>
                                            <span>{message.replyTo.isSelfQuote ? "You" : "Them"}: </span>
                                            {["text", "code"].includes(message.replyTo.type) 
                                                ? (message.replyTo.text || "Message").substring(0,40) 
                                                : `[${(message.replyTo.type || "media").toUpperCase()}]`
                                            }
                                        </div>
                                    )}

                                    {!message.fromSelf && currentChat.admin && !isGroupedWithPrev && (
                                        <span className="sender-name">{message.username}</span>
                                    )}
                                    
                                    <div className="message-payload">
                                        {renderMessageContent(message)}
                                    </div>

                                    <div className="meta">
                                        {message.timer && <FaClock className="timer-icon" title="Self-destructing message" />}
                                        <span>{formatTime(message.createdAt)}</span>
                                        {message.isStarred && <FaStar className="starred-icon" color="gold" size={10} />}
                                        {message.isEdited && <span className="edited-tag">(edited)</span>}
                                        
                                        {message.fromSelf && !message.isDeleted && (
                                            <div className="read-status">
                                                {renderStatusTicks(message)}
                                            </div>
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
                                                        <span key={emoji} onClick={() => handleReaction(message.id, emoji)} className="reaction-emoji-btn">{emoji}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            {message.fromSelf && message.type === "text" && (
                                                <button onClick={() => setEditingMessage({ id: message.id, text: message.message })} title="Edit"><FaPen size={12}/></button>
                                            )}
                                            <button onClick={() => handleDeleteMsg(message.id, message.fromSelf)} title="Delete"><FaTrash size={12}/></button>
                                        </div>
                                    )}
                                    
                                    {message.reactions?.length > 0 && !message.isDeleted && (
                                        <div className="reactions-display">
                                            {Object.entries(
                                                message.reactions.reduce((acc, r) => {
                                                    acc[r.emoji] = acc[r.emoji] || { count: 0, users: [] };
                                                    acc[r.emoji].count += 1;
                                                    acc[r.emoji].users.push(r.username);
                                                    return acc;
                                                }, {})
                                            ).map(([emoji, data]) => (
                                                <div 
                                                    key={emoji} 
                                                    className="reaction-pill" 
                                                    title={data.users.join(', ')} 
                                                >
                                                    <span className="reaction-anim">{emoji}</span>
                                                    {data.count > 1 && (
                                                        <span className="reaction-count" style={{ marginLeft: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                            {data.count}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                </div>
                            </div>
                        </div>
                    );
                }}
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