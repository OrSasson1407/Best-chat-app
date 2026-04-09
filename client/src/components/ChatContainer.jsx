import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition } from "react";
import ChatInput from "./ChatInput";
import axios from "axios";
import { Virtuoso } from "react-virtuoso"; 
import ColorThief from "color-thief-react"; 
import { motion, AnimatePresence } from "framer-motion";
import { 
    host, sendMessageRoute, receiveMessageRoute, getGroupMessagesRoute, 
    addGroupMemberRoute, reactMessageRoute, deleteMessageRoute, 
    deleteMessageForMeRoute, editMessageRoute, blockUserRoute, getChatMediaRoute,
    updateChatCustomizationRoute,
    getQuickRepliesRoute,
    publicKeyRoute,
    getGroupRoute,
    summarizeChatRoute,
    searchMessageRoute 
} from "../utils/APIRoutes";
import { encryptMessage, decryptMessage, encryptGroupMessage, decryptGroupMessage } from "../utils/crypto"; 
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { 
    FaThumbtack, FaSpinner, FaCloudUploadAlt, FaTimes, FaCheckDouble, FaArrowDown, FaMagic, FaGlobe 
} from "react-icons/fa";

import { ChatLayout, DropOverlay, ScrollButton, Lightbox, PinnedBanner, MessagesArea } from "./ChatContainer.styles"; 
import CallModal from "./CallModal"; 
import useChatStore from "../store/chatStore";

import ChatHeader from "./ChatHeader";
import ChatSidePanel from "./ChatSidePanel";
import MessageItem from "./MessageItem";
import { getSmallAvatar, formatTime } from "./chatHelpers";
import { triggerHaptic } from "../utils/haptics";

// ============================================================
// MODULE-LEVEL E2E BUNDLE CACHE
// ============================================================
const e2eBundleCache = new Map();
const NULL_CACHE_TTL_MS = 30_000;

async function getCachedBundle(userId, authHeader) {
  if (e2eBundleCache.has(userId)) {
    const cached = e2eBundleCache.get(userId);
    if (cached && !cached._noKeys) return cached;
    if (cached._noKeys && Date.now() - cached._cachedAt < NULL_CACHE_TTL_MS) {
      return null;
    }
    e2eBundleCache.delete(userId);
  }

  try {
    const res = await axios.get(`${publicKeyRoute}/${userId}`, authHeader);
    if (res.data.status && res.data.bundle?.identityKey) {
      e2eBundleCache.set(userId, res.data.bundle);
      return res.data.bundle;
    }
    e2eBundleCache.set(userId, { _noKeys: true, _cachedAt: Date.now() });
    return null;
  } catch (err) {
    if (err.response?.status === 404) {
      e2eBundleCache.set(userId, { _noKeys: true, _cachedAt: Date.now() });
    } else {
      console.error("[Crypto] Bundle fetch error:", err.message);
    }
    return null;
  }
}

export default function ChatContainer({ socket, isTyping }) {
  
  const currentChat = useChatStore((state) => state.currentChat);
  const currentUser = useChatStore((state) => state.currentUser);
  const theme = useChatStore((state) => state.theme);
  const isCompact = useChatStore((state) => state.isCompact);
  const loadOfflineMessages = useChatStore((state) => state.loadOfflineMessages);
  const cacheMessages = useChatStore((state) => state.cacheMessages);

  // --- CRITICAL FIX: Robust Group Identification ---
  const isGroupChat = Boolean(
      currentChat?.members || 
      currentChat?.groupKeys || 
      currentChat?.admins || 
      currentChat?.isChannel
  );

  // --- STATE MANAGEMENT ---
  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true); 
  
  const [activeGroupAesKey, setActiveGroupAesKey] = useState(null);
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
  const [droppedFile, setDroppedFile] = useState(null); 
  
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadScrollCount, setUnreadScrollCount] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [readReceiptsMsg, setReadReceiptsMsg] = useState(null); 
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);

  const [wallpaper, setWallpaper] = useState("");
  const [customTheme, setCustomTheme] = useState("#4e0eff");
  const [quickReplies, setQuickReplies] = useState([]);
  
  const [isGeneratingReplies, startGeneratingTransition] = useTransition();
  const [isSummarizing, startSummarizingTransition] = useTransition();
  const [isGlobalSearching, startSearchTransition] = useTransition();

  const [chatSummary, setChatSummary] = useState(null);
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState([]);

  const virtuosoRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const myPrivateKeyRef = useRef(null);
  const activeGroupAesKeyRef = useRef(null);
  const last5MessagesRef = useRef(""); // Used for sentiment logic

  const skeletonWidths = useMemo(() => ['45%', '65%', '35%', '80%', '50%'], []);
  
  const getAuthHeader = useCallback(() => {
    const rawToken = currentUser?.token || sessionStorage.getItem("chat-app-token") || "";
    const cleanToken = rawToken.replace(/(Bearer\s*)+/gi, "").trim();
    return { headers: { Authorization: `Bearer ${cleanToken}` } };
  }, [currentUser]);

  useEffect(() => {
      if (currentUser) {
          const rawKey = localStorage.getItem(`privateKey_${currentUser._id}`);
          myPrivateKeyRef.current = rawKey ? JSON.parse(rawKey) : null;
      }
  }, [currentUser]);

  useEffect(() => {
      activeGroupAesKeyRef.current = activeGroupAesKey;
  }, [activeGroupAesKey]);

  useEffect(() => {
    if (currentUser && currentChat) {
      const custom = currentUser.chatCustomizations?.find(c => c.chatId === currentChat._id);
      if (custom) {
        setWallpaper(custom.wallpaper || "");
        setCustomTheme(custom.themeColor || "#4e0eff");
      } else {
        setWallpaper("");
        setCustomTheme("#4e0eff");
      }
      setQuickReplies([]);
    }
  }, [currentChat, currentUser]);

  useEffect(() => {
      isScrolledUpRef.current = showScrollBtn;
  }, [showScrollBtn]);

  useEffect(() => {
    async function fetchHistory() {
      if (currentChat && currentUser) {
        setIsFetchingHistory(true);
        setActiveGroupAesKey(null); 

        if (!navigator.onLine) {
            const cached = await loadOfflineMessages(currentChat._id);
            if (cached && cached.length > 0) {
                setMessages(cached);
                toast.info("Showing cached offline messages.");
            } else {
                setMessages([]);
                toast.warning("No offline messages available.");
            }
            setIsFetchingHistory(false);
            return;
        }

        let response;
        let decryptedAesKey = null;

        try {
            const myPrivateKey = myPrivateKeyRef.current;

            if (isGroupChat) { 
                let freshGroup = currentChat;
                try {
                    const groupRes = await axios.get(`${getGroupRoute}/${currentChat._id}`, getAuthHeader());
                    if (groupRes.data) freshGroup = { ...currentChat, ...groupRes.data };
                } catch (e) {
                    console.warn("[Groups] Could not refresh group data, falling back to cached version:", e.message);
                }

                response = await axios.post(getGroupMessagesRoute, {
                    from: currentUser._id, groupId: currentChat._id,
                }, getAuthHeader());
                
                if (socket.current) socket.current.emit("join-group", currentChat._id);

                if (freshGroup.groupKeys && myPrivateKey) {
                    const myEncryptedKeyData = freshGroup.groupKeys.find(k => k.userId === currentUser._id);
                    if (myEncryptedKeyData) {
                        try {
                            const decryptedJwkString = await decryptMessage(myEncryptedKeyData.encryptedKey, myPrivateKey);
                            decryptedAesKey = JSON.parse(decryptedJwkString);
                            setActiveGroupAesKey(decryptedAesKey);
                        } catch (err) {
                            console.error("[Crypto] Failed to decrypt Group AES Key", err);
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
                    if (!isGroupChat && !msg.fromSelf && myPrivateKey) {
                        const decryptedText = await decryptMessage(msg.message, myPrivateKey);
                        return { ...msg, message: decryptedText };
                    } else if (isGroupChat && decryptedAesKey) {
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

            const lastMsg = decryptedMessages[decryptedMessages.length - 1];
            if (lastMsg && !lastMsg.fromSelf && lastMsg.type === "text") {
                generateAIReplies(lastMsg.message);
            }

            fetchedMessages.forEach((msg) => {
                if (!msg.fromSelf && msg.status !== "read" && socket.current) {
                    // FIX: Ensure 'to' field correctly maps to currentChat._id for groups
                    socket.current.emit("mark-as-read", { 
                        messageId: msg.id, from: currentUser._id, 
                        to: isGroupChat ? currentChat._id : msg.from,
                        isGroup: isGroupChat, username: currentUser.username
                    });
                }
            });

        } catch (error) {
            console.error("[API] Error fetching messages:", error);
            if (error.response?.status === 401) toast.error("Session expired. Please log in again.");
        } finally {
            setIsFetchingHistory(false);
        }
      }
    }
    fetchHistory();
  }, [currentChat, currentUser, getAuthHeader, socket, loadOfflineMessages, isGroupChat]);

  useEffect(() => {
      if (currentChat && messages.length > 0) {
          cacheMessages(currentChat._id, messages);
      }
  }, [messages, currentChat, cacheMessages]);

  // FIX: Sentiment Analysis Render Thrashing 
  // Debounce and only run logic when new text messages are appended.
  useEffect(() => {
      if (messages.length > 0) {
          const last5 = messages.slice(-5).filter(m => m.type === 'text');
          const last5Key = last5.map(m => m.id).join(",");

          if (last5Key !== last5MessagesRef.current) {
              last5MessagesRef.current = last5Key;
              
              const positiveWords = ['happy', 'lol', 'love', 'great', 'awesome', 'good', 'nice', 'sweet', 'yay', 'haha'];
              const negativeWords = ['bad', 'sad', 'angry', 'hate', 'stop', 'terrible', 'worst', 'ugh', 'mad'];
              
              let score = 0;
              last5.forEach(m => {
                  if (typeof m.message === 'string') {
                      const text = m.message.toLowerCase();
                      positiveWords.forEach(w => { if(text.includes(w)) score++ });
                      negativeWords.forEach(w => { if(text.includes(w)) score-- });
                  }
              });

              const hue = score > 0 ? '140' : score < 0 ? '250' : '250';
              const currentHue = document.documentElement.style.getPropertyValue('--sentiment-hue');
              if (currentHue !== hue) {
                  document.documentElement.style.setProperty('--sentiment-hue', hue);
              }
          }
      }
  }, [messages]);

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
                  console.error("[API] Failed to fetch media/links for side panel.", err);
              } finally {
                  setIsFetchingMedia(false);
              }
          };
          fetchMedia();
      }
  }, [showSidePanel, currentChat, currentUser, activeSideTab, getAuthHeader]);

  useEffect(() => {
      if (socket.current && currentUser) {
          const s = socket.current;
          const heartbeatInterval = setInterval(() => s.emit("heartbeat", currentUser._id), 30000); 
          return () => clearInterval(heartbeatInterval);
      }
  }, [socket, currentUser]);

  useEffect(() => {
    if (socket.current) {
      const s = socket.current;
      if (currentChat && !isGroupChat) s.emit("check-presence", currentChat._id);

      const handlePresenceResponse = (data) => {
        if (data.userId === currentChat._id) { setIsOnline(data.isOnline); setLastSeen(data.lastSeen); }
      };

      const handleMsgRecieve = async (data) => {
        const isForCurrentChat = data.isGroup
          ? currentChat._id === data.to          
          : currentChat._id === data.from;       

        if (!isForCurrentChat) return;

        let decryptedText = data.msg;
        const myPrivateKey = myPrivateKeyRef.current;

        if (data.type === "text") {
            if (!data.isGroup && myPrivateKey) {
                decryptedText = await decryptMessage(data.msg, myPrivateKey);
            } else if (data.isGroup) {
                let aesKeyToUse = activeGroupAesKeyRef.current;

                // FIX: Decryption Key Race Condition
                // If a group message arrives before the AES key is loaded into state, 
                // attempt to resolve it directly from the currentChat object.
                if (!aesKeyToUse && currentChat && currentChat.groupKeys && myPrivateKey) {
                     const myEncryptedKeyData = currentChat.groupKeys.find(k => k.userId === currentUser._id);
                     if (myEncryptedKeyData) {
                         try {
                             const decryptedJwkString = await decryptMessage(myEncryptedKeyData.encryptedKey, myPrivateKey);
                             aesKeyToUse = JSON.parse(decryptedJwkString);
                         } catch (err) { 
                             console.error("Emergency group key decryption failed", err); 
                         }
                     }
                }

                if (aesKeyToUse) {
                    decryptedText = await decryptGroupMessage(data.msg, aesKeyToUse);
                }
            }
            generateAIReplies(decryptedText);
        }

        setArrivalMessage({ 
            id: data.id, fromSelf: false, message: decryptedText, type: data.type, 
            createdAt: data.createdAt, username: data.username, replyTo: data.replyTo,
            reactions: [], status: "delivered", isDeleted: false, isEdited: false,
            isForwarded: data.isForwarded, isViewOnce: data.isViewOnce, viewed: false,
            isStarred: false, pollData: data.pollData, linkMetadata: data.linkMetadata,
            fileMetadata: data.fileMetadata, readBy: []
        });
        
        // FIX: Wrong Target for Group Read Receipts
        // Group receipts need to go back to the group ID (`data.to`), not the individual sender (`data.from`).
        s.emit("mark-as-read", { 
            messageId: data.id, from: currentUser._id, 
            to: data.isGroup ? data.to : data.from,
            isGroup: isGroupChat, username: currentUser.username
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

      const handleMediaReady = ({ messageId, url, type }) => {
          setMessages((prev) => prev.map(msg => {
              if (msg.id === messageId) {
                  return { ...msg, message: url, status: "sent" };
              }
              return msg;
          }));
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
      s.on("media-ready", handleMediaReady);

      return () => {
          s.off("presence-response", handlePresenceResponse); 
          s.off("user-status-change", handlePresenceResponse); 
          s.off("msg-recieve", handleMsgRecieve);
          s.off("receive-reaction", handleReactionReceive); 
          s.off("msg-read-update", handleMsgReadUpdate); 
          s.off("group-msg-read-update", handleGroupMsgReadUpdate);
          s.off("msg-deleted", handleMsgDeleted); 
          s.off("msg-edited", handleMsgEdited); 
          s.off("incoming-call", handleIncomingCall); 
          s.off("media-ready", handleMediaReady); 
      };
    }
  }, [socket, currentUser, currentChat, activeGroupAesKey, isGroupChat]);

  useEffect(() => {
    if (arrivalMessage) {
        setMessages((prev) => [...prev, arrivalMessage]);
        if (isScrolledUpRef.current) {
            setUnreadScrollCount(prev => prev + 1);
        }
    }
  }, [arrivalMessage]);

  const executeGlobalSearch = (query) => {
      if (!query.trim()) return;
      startSearchTransition(async () => {
          try {
              const { data } = await axios.post(searchMessageRoute, { userId: currentUser._id, query }, getAuthHeader());
              if (data.status) {
                  setGlobalSearchResults(data.messages);
              } else {
                  setGlobalSearchResults([]);
              }
          } catch (error) {
              console.error("Global search failed:", error);
              toast.error("Failed to search messages.");
          }
      });
  };

  const handleSummarize = () => {
      startSummarizingTransition(async () => {
          try {
              const { data } = await axios.post(summarizeChatRoute, {
                  from: currentUser._id,
                  to: currentChat._id,
                  limit: 50
              }, getAuthHeader());

              if (data.status) {
                  setChatSummary(data.summary);
              } else {
                  toast.info(data.msg); 
              }
          } catch (error) {
              console.error("Summary error", error);
              toast.error("Failed to summarize chat.");
          }
      });
  };

  const loadMoreMessages = useCallback(async () => {
    if (hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      try {
          let response;
          if (isGroupChat) {
              response = await axios.post(getGroupMessagesRoute, { from: currentUser._id, groupId: currentChat._id, cursor }, getAuthHeader());
          } else {
              response = await axios.post(receiveMessageRoute, { from: currentUser._id, to: currentChat._id, cursor }, getAuthHeader());
          }

          const newMessages = response.data.messages ? response.data.messages : response.data;
          const myPrivateKey = myPrivateKeyRef.current;
          
          const decryptedNewMessages = await Promise.all(newMessages.map(async (msg) => {
              if (msg.type === "text" && !msg.isDeleted) {
                  if (!isGroupChat && !msg.fromSelf && myPrivateKey) {
                      const decryptedText = await decryptMessage(msg.message, myPrivateKey);
                      return { ...msg, message: decryptedText };
                  } else if (isGroupChat && activeGroupAesKey) {
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
          console.error("[API] Failed to fetch older messages", error);
      } finally {
          setIsLoadingMore(false);
      }
    }
  }, [hasMore, isLoadingMore, currentChat, currentUser, cursor, activeGroupAesKey, getAuthHeader, isGroupChat]);

  const scrollToBottom = useCallback(() => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
      setUnreadScrollCount(0); 
  }, [messages.length]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  
  const handleDrop = (e) => {
    e.preventDefault(); 
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        triggerHaptic('success'); 
        toast.info(`Preparing to send ${files[0].name}...`);
        setDroppedFile(files[0]); 
    }
  };

  const handleWallpaperChange = async (colorOrUrl) => {
    setWallpaper(colorOrUrl);
    try {
      await axios.post(updateChatCustomizationRoute, { userId: currentUser._id, chatId: currentChat._id, wallpaper: colorOrUrl }, getAuthHeader());
      toast.success("Chat wallpaper updated.");
    } catch (e) {
      console.error("[UI] Failed to update wallpaper", e);
      toast.error("Failed to update wallpaper.");
    }
  };

  const generateAIReplies = (text) => {
      if (!text || text.length < 5) {
          setQuickReplies([]);
          return;
      }
      startGeneratingTransition(async () => {
          try {
              const { data } = await axios.post(getQuickRepliesRoute, { message: text }, getAuthHeader());
              if (data.status && Array.isArray(data.replies)) setQuickReplies(data.replies);
          } catch (err) {
              console.error("[AI] Failed to generate AI replies", err);
              setQuickReplies([]);
          }
      });
  };

  const handleSendMsg = useCallback(async (msg, type = "text", replyToId = null, extraData = {}) => {
    const time = new Date().toISOString();
    let finalMessageContent = msg;
    const newMessageId = uuidv4(); 
    setQuickReplies([]);

    triggerHaptic('light');

    try {
        if (type === "text") {
            if (!isGroupChat) {
                const bundle = await getCachedBundle(currentChat._id, getAuthHeader());

                if (bundle?.identityKey) {
                    try {
                        finalMessageContent = await encryptMessage(msg, bundle.identityKey);
                    } catch (err) {
                        console.error("[Crypto] Encryption failed, sending as plaintext:", err.message);
                        toast.warning("⚠️ Encryption failed — message sent unencrypted.", { toastId: "enc-fail", autoClose: 4000 });
                    }
                } else {
                    toast.warning(
                        `⚠️ ${currentChat.username} has no encryption keys yet. Ask them to log out and back in. Message sent unencrypted.`,
                        { toastId: "no-e2e-keys", autoClose: 6000 }
                    );
                    console.warn("[Crypto] No E2E keys for this user — sending as plaintext.");
                }
            } else if (isGroupChat && activeGroupAesKey) {
                try {
                    finalMessageContent = await encryptGroupMessage(msg, activeGroupAesKey);
                } catch (err) {
                    console.error('[Crypto] Group encryption failed, sending as plaintext:', err);
                    finalMessageContent = msg;
                }
            }
        }

        const payload = {
            from: currentUser._id, to: currentChat._id, message: finalMessageContent, 
            type, replyTo: replyToId, isForwarded: extraData.isForwarded || false,
            isViewOnce: extraData.isViewOnce || false, pollData: extraData.pollData || null,
            timer: extraData.timer || null, fileName: extraData.fileName || null, fileSize: extraData.fileSize || null,
            scheduledAt: extraData.scheduledAt || null, 
            localId: extraData.localId || newMessageId 
        };

        const fileMetadataObj = extraData.fileName ? { fileName: extraData.fileName, fileSize: extraData.fileSize } : null;

        const socketData = {
            id: newMessageId, to: currentChat._id, from: currentUser._id, 
            msg: finalMessageContent, type: type, isGroup: isGroupChat, 
            username: currentUser.username, 
            replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, type: replyingTo.type, isSelfQuote: replyingTo.isSelfQuote } : null,
            ...payload, linkMetadata: null, fileMetadata: fileMetadataObj 
        };
        
        setMessages((prev) => [ ...prev, { 
              id: newMessageId, fromSelf: true, message: msg, type: type, createdAt: time, 
              replyTo: socketData.replyTo, reactions: [], status: "pending", isDeleted: false, isEdited: false,
              isForwarded: payload.isForwarded, isViewOnce: payload.isViewOnce, viewed: false, 
              pollData: payload.pollData, linkMetadata: null, timer: payload.timer, fileMetadata: fileMetadataObj, readBy: []
        }]);
        setReplyingTo(null); 

        const res = await axios.post(sendMessageRoute, payload, getAuthHeader());
        const generatedLinkData = res.data.data?.linkMetadata || null;
        socketData.linkMetadata = generatedLinkData;

        socket.current.emit("send-msg", socketData, (response) => {
            if (response && response.status) {
                triggerHaptic('success');
                setMessages((prev) => prev.map(m => m.id === newMessageId ? { ...m, status: response.status, linkMetadata: generatedLinkData } : m));
            }
        });

    } catch (error) {
        if (error.response && error.response.status === 403) {
            toast.error("You cannot message this user.");
            setMessages((prev) => prev.filter(m => m.id !== newMessageId));
        } else {
            console.error("[API] Failed to send message", error);
            toast.error("Failed to send message. Tap the message to retry.");
            setMessages((prev) => prev.map(m =>
                m.id === newMessageId ? { ...m, status: "failed" } : m
            ));
        }
    }
  }, [currentChat, currentUser, activeGroupAesKey, replyingTo, getAuthHeader, socket, isGroupChat]);

  const handleRetryMsg = useCallback((failedMsg) => {
      setMessages((prev) => prev.filter(m => m.id !== failedMsg.id));
      handleSendMsg(
          failedMsg.message,
          failedMsg.type,
          failedMsg.replyTo?.id || null,
          {
              isForwarded: failedMsg.isForwarded,
              isViewOnce: failedMsg.isViewOnce,
              pollData: failedMsg.pollData,
              timer: failedMsg.timer,
              fileName: failedMsg.fileMetadata?.fileName,
              fileSize: failedMsg.fileMetadata?.fileSize
          }
      );
  }, [handleSendMsg]);

  const handleEditMsgSubmit = useCallback(async (messageId, newText) => {
      try {
          await axios.post(editMessageRoute, { messageId, newText }, getAuthHeader()); 
          socket.current.emit("edit-msg", { messageId, newText, to: currentChat._id, isGroup: isGroupChat });
          setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, message: newText, isEdited: true } : msg));
          setEditingMessage(null);
      } catch (error) { 
          console.error("[API] Failed to edit message", error);
          toast.error("Failed to edit message."); 
      }
  }, [currentChat, getAuthHeader, socket, isGroupChat]);

  const handleDeleteMsg = useCallback(async (messageId, fromSelf) => {
      const options = fromSelf ? "Press OK to 'Delete for Everyone', or Cancel to 'Delete for Me'." : "Delete this message for yourself?";
      const deleteForEveryone = fromSelf ? window.confirm(options) : false;

      try {
          if (deleteForEveryone) {
              await axios.post(deleteMessageRoute, { messageId }, getAuthHeader()); 
              socket.current.emit("delete-msg", { messageId, to: currentChat._id, isGroup: isGroupChat });
              setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, isDeleted: true, message: "🚫 This message was deleted", reactions: [], linkMetadata: null, pollData: null } : msg));
              triggerHaptic('heavy'); 
          } else {
              const confirmDeleteForMe = fromSelf ? window.confirm("Delete for me then?") : window.confirm(options);
              if (confirmDeleteForMe) {
                  await axios.post(deleteMessageForMeRoute, { messageId, userId: currentUser._id }, getAuthHeader());
                  setMessages((prev) => prev.filter(msg => msg.id !== messageId));
                  toast.success("Message deleted.");
                  triggerHaptic('heavy'); 
              }
          }
      } catch (error) { 
          console.error("[API] Failed to delete message", error);
          toast.error("Failed to delete message."); 
      }
  }, [currentChat, currentUser, getAuthHeader, socket, isGroupChat]);

  const handleReaction = useCallback(async (messageId, emoji) => {
      try {
          triggerHaptic('light'); 
          const res = await axios.post(reactMessageRoute, { messageId, emoji, userId: currentUser._id, username: currentUser.username }, getAuthHeader());
          setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reactions: res.data.reactions } : msg));
          socket.current.emit("send-reaction", { messageId, reactions: res.data.reactions, to: currentChat._id, isGroup: isGroupChat });
      } catch (e) { 
          console.error("[API] Failed to react to message", e); 
      }
  }, [currentChat, currentUser, getAuthHeader, socket, isGroupChat]);

  const handleOpenViewOnce = useCallback(async (msgId) => {
    setMessages(prev => prev.map(m => m.id === msgId ? {...m, viewed: true, message: "💣 Media Expired"} : m));
  }, []);

  const handleTyping = useCallback((typing) => {
    socket.current.emit("typing", { to: currentChat._id, from: currentUser._id, isTyping: typing, isGroup: isGroupChat, username: currentUser.username });
  }, [currentChat, currentUser, socket, isGroupChat]);

  const handleAddMember = async () => {
      const userId = prompt("Enter the User ID to add to this group:");
      if (!userId || !userId.trim()) return;

      try {
          let encryptedKey = null;

          if (activeGroupAesKey) {
              try {
                  const pkResponse = await axios.get(`${publicKeyRoute}/${userId.trim()}`, getAuthHeader());
                  if (pkResponse.data.status && pkResponse.data.bundle?.identityKey) {
                      const aesKeyString = JSON.stringify(activeGroupAesKey);
                      encryptedKey = await encryptMessage(aesKeyString, pkResponse.data.bundle.identityKey);
                  } else {
                      toast.warning(
                          "⚠️ This user has no E2E keys yet — they'll be added but won't see encrypted messages until they log out and back in.",
                          { autoClose: 6000 }
                      );
                  }
              } catch (err) {
                  console.warn("[Crypto] Could not encrypt group AES key for new member:", err.message);
                  toast.warning("⚠️ Could not encrypt group key for this user. They may not be able to read messages.");
              }
          }

          await axios.post(addGroupMemberRoute, {
              groupId: currentChat._id,
              userId: userId.trim(),
              encryptedKey,   
          }, getAuthHeader());

          toast.success("Member added successfully.");
      } catch (e) { 
          console.error("[API] Failed to add member", e);
          toast.error(e.response?.data?.msg || "Failed to add member."); 
      }
  };

  const handleToggleBlock = async () => {
      try {
          await axios.post(blockUserRoute, { userId: currentUser._id, blockedUserId: currentChat._id }, getAuthHeader());
          setIsBlocked(!isBlocked);
          toast.success(isBlocked ? "User unblocked." : "User blocked.");
      } catch (e) { 
          console.error("[API] Failed to update block status", e);
          toast.error("Failed to update block status."); 
      }
  };

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (!searchQuery) return true;
      if (msg.type !== "text" && msg.type !== "link") return false;
      return msg.message && msg.message.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [messages, searchQuery]);

  const scrollToMessage = useCallback((msgId) => {
      const index = filteredMessages.findIndex(m => m.id === msgId);
      if (index !== -1) {
          virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
          setHighlightedMsgId(msgId);
          setTimeout(() => setHighlightedMsgId(null), 1500);
      }
  }, [filteredMessages]);

  return (
    <ColorThief src={currentChat?.avatarImage || "default"} crossOrigin="anonymous" format="hex">
      {({ data, loading }) => {
        const adaptiveAccent = data || customTheme || "#4e0eff";
        
        return (
          <ChatLayout 
            $themeType={theme} 
            $isCompact={isCompact} 
            $hasPinned={!!pinnedMessage} 
            onDragOver={handleDragOver}
            style={{ 
              "--adaptive-accent": adaptiveAccent,
              "--chat-wallpaper": wallpaper && wallpaper !== "transparent" ? 
                  (wallpaper.startsWith("http") || wallpaper.startsWith("data:") ? `url(${wallpaper})` : wallpaper) 
                  : "transparent"
            }}
          >
            <AnimatePresence>
                {chatSummary && (
                    <Lightbox as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChatSummary(null)}>
                        <motion.div className="receipt-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                            <button className="close-btn-small" onClick={() => setChatSummary(null)}><FaTimes /></button>
                            <h3><FaMagic color={adaptiveAccent} style={{ marginRight: '8px' }}/> Chat Summary</h3>
                            <div style={{ padding: '1rem', lineHeight: '1.6', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{chatSummary}</div>
                            </div>
                        </motion.div>
                    </Lightbox>
                )}

                {showGlobalSearchModal && (
                    <Lightbox as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGlobalSearchModal(false)}>
                        <motion.div className="receipt-modal" style={{ width: '600px', maxWidth: '95%' }} onClick={e => e.stopPropagation()}>
                            <button className="close-btn-small" onClick={() => setShowGlobalSearchModal(false)}><FaTimes /></button>
                            <h3><FaGlobe color={adaptiveAccent} style={{ marginRight: '8px' }}/> Global Search</h3>
                            
                            <input
                                id="globalSearchInput"
                                name="globalSearchInput"
                                autoFocus
                                type="text"
                                placeholder="Search all your chats..."
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-main)', marginBottom: '15px', fontSize: '1rem', outline: 'none' }}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') executeGlobalSearch(e.target.value);
                                }}
                            />
                            
                            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {isGlobalSearching ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                                        <FaSpinner className="fa-spin" size={24} /> <br/> Searching everywhere...
                                    </div>
                                ) : globalSearchResults.length > 0 ? (
                                    globalSearchResults.map((res, i) => (
                                        <div key={i} style={{ padding: '10px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                                                {formatTime(res.createdAt)}
                                            </div>
                                            <div style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{res.text || res.message?.text}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                        Press Enter to search across all chats.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </Lightbox>
                )}

                {isDragging && (
                  <DropOverlay 
                      as={motion.div}
                      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                      animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
                      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                      transition={{ duration: 0.2 }}
                      onDragLeave={handleDragLeave} 
                      onDrop={handleDrop}
                  >
                    <motion.div 
                        className="overlay-content"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.8 }}
                    >
                      <FaCloudUploadAlt size={80} color={adaptiveAccent} />
                      <h2>Drop files to share</h2>
                      <p>Images, Videos, and Documents</p>
                    </motion.div>
                  </DropOverlay>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCallModal && (
                    <CallModal socket={socket} currentUser={currentUser} currentChat={currentChat} incomingCallData={incomingCallData} closeModal={() => { setShowCallModal(false); setIncomingCallData(null); }} />
                )}

                {lightboxImage && (
                  <Lightbox 
                      as={motion.div}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setLightboxImage(null)}
                  >
                    <button className="close-btn"><FaTimes /></button>
                    <motion.img 
                        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        src={lightboxImage} alt="Fullscreen" onClick={(e) => e.stopPropagation()} 
                    />
                  </Lightbox>
                )}

                {readReceiptsMsg && (
                  <Lightbox 
                      as={motion.div}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setReadReceiptsMsg(null)}
                  >
                      <motion.div 
                          className="receipt-modal" 
                          initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                          onClick={(e) => e.stopPropagation()}
                      >
                          <button className="close-btn-small" onClick={() => setReadReceiptsMsg(null)}><FaTimes /></button>
                          <h3>Message Info</h3>
                          <div className="msg-preview">
                              {readReceiptsMsg.message?.substring(0, 40)}
                              {readReceiptsMsg.message?.length > 40 ? "..." : ""}
                          </div>
                          <div className="readers-list">
                              <h4><FaCheckDouble color="#34B7F1"/> Read by ({readReceiptsMsg.readBy?.length || 0})</h4>
                              
                              {(!readReceiptsMsg.readBy || readReceiptsMsg.readBy.length === 0) ? (
                                  <p style={{color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '10px'}}>No one has read this yet.</p>
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
                      </motion.div>
                  </Lightbox>
                )}
            </AnimatePresence>

            {showSidePanel && (
              <ChatSidePanel 
                  theme={theme} currentChat={currentChat} isOnline={isOnline} lastSeen={lastSeen}
                  activeSideTab={activeSideTab} setActiveSideTab={setActiveSideTab}
                  setShowSidePanel={setShowSidePanel} isFetchingMedia={isFetchingMedia}
                  chatMedia={chatMedia} setLightboxImage={setLightboxImage}
                  handleWallpaperChange={handleWallpaperChange}
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
                handleSummarize={handleSummarize} isSummarizing={isSummarizing}
                setShowGlobalSearchModal={setShowGlobalSearchModal}
            />
            
            <AnimatePresence>
                {pinnedMessage && (
                    <PinnedBanner 
                        as={motion.div}
                        onClick={() => scrollToMessage(pinnedMessage.id)}
                        initial={{ y: -50, opacity: 0 }} 
                        animate={{ y: 0, opacity: 1 }} 
                        exit={{ y: -50, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                        <FaThumbtack /> 
                        <div className="pin-content">
                            <span className="pin-title">Pinned Message</span>
                            <span className="pin-text">{pinnedMessage.message.substring(0, 80)}...</span>
                        </div>
                    </PinnedBanner>
                )}
            </AnimatePresence>

            <MessagesArea $themeType={theme} $isCompact={isCompact}>
              {isFetchingHistory ? (
                  <div className="skeleton-container">
                      {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`message skeleton-msg ${i % 2 === 0 ? 'sended' : 'recieved'}`}>
                              <div className="content skeleton-anim" style={{width: skeletonWidths[i], height: '45px'}}/>
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
                                          {typeof isTyping === 'string' && isGroupChat && (
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
                              handleRetryMsg={handleRetryMsg} 
                          />
                      )}
                  />
              )}
            </MessagesArea>

            <AnimatePresence>
                {showScrollBtn && (
                  <ScrollButton 
                      as={motion.button}
                      onClick={scrollToBottom}
                      initial={{ scale: 0, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0, opacity: 0, y: 20 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                  >
                      <FaArrowDown />
                      {unreadScrollCount > 0 && (
                          <span className="unread-badge">
                              {unreadScrollCount > 99 ? '99+' : unreadScrollCount}
                          </span>
                      )}
                  </ScrollButton>
                )}
            </AnimatePresence>

            {(!currentChat?.isChannel || currentChat?.admins?.includes(currentUser._id) || currentChat?.moderators?.includes(currentUser._id)) && (
                <div style={{ position: 'relative', width: '100%', padding: '0 2rem' }}>
                    <AnimatePresence mode="wait">
                        {isGeneratingReplies ? (
                            <motion.div 
                                key="thinking"
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '8px' }}
                            >
                                <FaMagic className="fa-spin" color={adaptiveAccent} /> AI is thinking...
                            </motion.div>
                        ) : quickReplies.length > 0 ? (
                            <motion.div 
                                key="replies"
                                initial="hidden" animate="visible" exit="hidden"
                                variants={{
                                    visible: { transition: { staggerChildren: 0.1 } },
                                    hidden: {}
                                }}
                                style={{ display: 'flex', gap: '12px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '6px' }}
                            >
                                <FaMagic color={adaptiveAccent} style={{ marginTop: '10px', flexShrink: 0, fontSize: '1.2rem' }} title="AI Suggestions" />
                                {quickReplies.map((reply, i) => (
                                    <motion.button 
                                        key={i} 
                                        onClick={() => handleSendMsg(reply, "text")}
                                        variants={{
                                            hidden: { opacity: 0, scale: 0.8, y: 10 },
                                            visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" } }
                                        }}
                                        whileHover={{ y: -3, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: adaptiveAccent }}
                                        whileTap={{ scale: 0.95 }}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                                            color: '#fff', padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap',
                                            backdropFilter: 'blur(10px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                        }}
                                    >
                                        {reply}
                                    </motion.button>
                                ))}
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            )}
            
            <ChatInput 
                handleSendMsg={handleSendMsg} handleTyping={handleTyping} 
                replyingTo={replyingTo} setReplyingTo={setReplyingTo} 
                editingMessage={editingMessage} setEditingMessage={setEditingMessage}
                handleEditMsgSubmit={handleEditMsgSubmit}
                droppedFile={droppedFile}
                onClearDrop={() => setDroppedFile(null)}
            />
          </ChatLayout>
        );
      }}
    </ColorThief>
  );
}