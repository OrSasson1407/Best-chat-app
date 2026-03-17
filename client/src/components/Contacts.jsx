import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { 
    FaUserFriends, FaPlus, FaSearch, FaCog, FaThumbtack, 
    FaRegEnvelope, FaTimes, FaSpinner, FaShieldAlt, FaEye, FaGlobe,
    FaSun, FaMoon, FaSignOutAlt, FaCheck, FaChevronLeft, FaChevronRight 
} from "react-icons/fa";
import { BsChatDotsFill, BsPeopleFill } from "react-icons/bs";
import { MdOutlineAllInclusive } from "react-icons/md";
import axios from "axios";
import { 
    host, createGroupRoute, getUserGroupsRoute, updateProfileRoute, 
    searchMessageRoute, getStoryFeedRoute, addStoryRoute, viewStoryRoute,
    searchChannelsRoute, joinChannelRoute, publicKeyRoute 
} from "../utils/APIRoutes";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import useChatStore from "../store/chatStore";
import { generateGroupAESKey, encryptMessage } from "../utils/crypto"; 

const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

const formatLastSeen = (dateString) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric'});
};

export default function Contacts({ contacts, changeChat, handleLogout }) {
  const {
      currentUser, onlineUsers, theme, setTheme, 
      isCompact, setIsCompact, globalTypingUsers
  } = useChatStore();

  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  const [activeFolder, setActiveFolder] = useState("all"); 
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
        const saved = localStorage.getItem(`pinned-chats-${currentUser?._id}`);
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  const [globalMessages, setGlobalMessages] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  
  // Channels
  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [discoveredChannels, setDiscoveredChannels] = useState([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);

  // User Profile
  const [profileData, setProfileData] = useState({
      statusIcon: "✨", statusMessage: "Available", bio: "", interests: "",
      privacySettings: { lastSeen: "everyone", readReceipts: true, profilePhoto: "everyone" }
  });
  const [hasPin, setHasPin] = useState(!!localStorage.getItem("app-pin-code"));

  // Stories
  const [storyFeed, setStoryFeed] = useState([]);
  const [viewingStoryUser, setViewingStoryUser] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const fileInputRef = useRef(null);

  // Interactive Long Press Story State
  const pressTimer = useRef(null);
  const [storyPreview, setStoryPreview] = useState(null);

  // Initialize Data
  useEffect(() => {
    const fetchGroupsAndStories = async () => {
      if(currentUser && currentUser.token) {
          try {
              const [groupRes, storyRes] = await Promise.all([
                  axios.get(getUserGroupsRoute, { headers: { "x-auth-token": currentUser.token }, withCredentials: true }),
                  axios.get(getStoryFeedRoute, { headers: { "x-auth-token": currentUser.token }, withCredentials: true })
              ]);
              setGroups(groupRes.data || []);
              if(storyRes.data.status) setStoryFeed(storyRes.data.feed || []);
          } catch (error) { 
              console.error("[API] Error fetching contacts data:", error); 
          } 
          finally { setIsLoading(false); }
      }
    };

    if (currentUser) {
      setCurrentUserName(currentUser.username);
      setProfileData({
          statusIcon: currentUser.statusIcon || "✨",
          statusMessage: currentUser.statusMessage || "Available",
          bio: currentUser.bio || "",
          interests: currentUser.interests ? currentUser.interests.join(", ") : "",
          privacySettings: currentUser.privacySettings || { lastSeen: "everyone", readReceipts: true, profilePhoto: "everyone" }
      });
      fetchGroupsAndStories();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) localStorage.setItem(`pinned-chats-${currentUser._id}`, JSON.stringify(pinnedIds));
  }, [pinnedIds, currentUser]);

  useEffect(() => {
      let timer;
      if (viewingStoryUser && viewingStoryUser.stories) {
          timer = setTimeout(() => handleNextStory(), 5000); 
      }
      return () => clearTimeout(timer);
  }, [viewingStoryUser, currentStoryIndex]);

  // Debounced Search Logic
  useEffect(() => {
      if (!searchTerm || searchTerm.length < 3) {
          setGlobalMessages([]);
          return;
      }
      const delayDebounceFn = setTimeout(async () => {
          setIsSearchingGlobal(true);
          try {
              const { data } = await axios.post(searchMessageRoute, { userId: currentUser._id, query: searchTerm }, { headers: { "x-auth-token": currentUser.token }, withCredentials: true });
              if (data.status) setGlobalMessages(data.messages || []);
          } catch (error) { 
              console.error("[API] Error searching messages:", error); 
          } 
          finally { setIsSearchingGlobal(false); }
      }, 600);
      return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentUser]);

  useEffect(() => {
      if (!channelSearchQuery) {
          setDiscoveredChannels([]); return;
      }
      const delayDebounceFn = setTimeout(async () => {
          setIsSearchingChannels(true);
          try {
              const { data } = await axios.get(`${searchChannelsRoute}?query=${channelSearchQuery}`, { headers: { "x-auth-token": currentUser.token }, withCredentials: true });
              if (data.status) setDiscoveredChannels(data.channels || []);
          } catch (error) { 
              console.error("[API] Error searching channels:", error); 
          } 
          finally { setIsSearchingChannels(false); }
      }, 500);
      return () => clearTimeout(delayDebounceFn);
  }, [channelSearchQuery, currentUser]);

  // Handlers
  const togglePin = useCallback((e, id) => {
    e.stopPropagation(); 
    setPinnedIds((prev) => {
        const currentPins = prev || [];
        if (currentPins.includes(id)) { 
            toast.info("Chat unpinned."); 
            return currentPins.filter(pid => pid !== id); 
        } 
        else {
            if (currentPins.length >= 5) { 
                toast.warning("You can only pin up to 5 chats."); 
                return currentPins; 
            }
            toast.success("Chat pinned."); 
            return [...currentPins, id];
        }
    });
  }, []);

  const changeCurrentChat = useCallback((contact, isGroup = false) => {
    setCurrentSelected(contact._id);
    changeChat(contact, isGroup); 
  }, [changeChat]);

  const handleGlobalMessageClick = (msg) => {
      let targetChat = groups.find(g => msg.users?.includes(g._id));
      let isGroupChat = !!targetChat;

      if (!targetChat) {
          const otherUserId = msg.users?.find(id => id !== currentUser._id);
          targetChat = contacts.find(c => c._id === otherUserId);
      }

      if (targetChat) {
          changeCurrentChat(targetChat, isGroupChat);
          setSearchTerm(""); 
      } else { 
          toast.error("Chat not found. It may have been deleted."); 
      }
  };

  const handleStoryUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setIsUploadingStory(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
          try {
              const { data } = await axios.post(addStoryRoute, { mediaUrl: reader.result, mediaType: file.type.startsWith("video") ? "video" : "image" }, { headers: { "x-auth-token": currentUser.token }, withCredentials: true });
              if (data.status) {
                  toast.success("Status updated.");
                  const storyRes = await axios.get(getStoryFeedRoute, { headers: { "x-auth-token": currentUser.token }, withCredentials: true });
                  setStoryFeed(storyRes.data.feed || []);
              }
          } catch (err) { 
              console.error("[Media] Failed to upload status:", err);
              toast.error("Status upload failed. Please try again."); 
          } 
          finally { setIsUploadingStory(false); }
      };
  };

  const openStoryViewer = async (userFeedObj) => {
      setViewingStoryUser(userFeedObj);
      setCurrentStoryIndex(0);
      const firstStory = userFeedObj?.stories?.[0];
      if (firstStory && firstStory.user?._id !== currentUser._id) {
          try { await axios.post(`${viewStoryRoute}/${firstStory._id}`, {}, { headers: { "x-auth-token": currentUser.token }, withCredentials: true }); } 
          catch (error) { console.error("[API] Failed to mark story as viewed", error); }
      }
  };

  const handleNextStory = async () => {
      if (!viewingStoryUser || !viewingStoryUser.stories) return;
      if (currentStoryIndex < viewingStoryUser.stories.length - 1) {
          const nextIdx = currentStoryIndex + 1;
          setCurrentStoryIndex(nextIdx);
          const nextStory = viewingStoryUser.stories[nextIdx];
          if (nextStory && nextStory.user?._id !== currentUser._id) {
              try { await axios.post(`${viewStoryRoute}/${nextStory._id}`, {}, { headers: { "x-auth-token": currentUser.token }, withCredentials: true }); } 
              catch (error) { console.error("[API] Failed to mark story as viewed", error); }
          }
      } else { setViewingStoryUser(null); }
  };

  const handleStoryPressStart = (feedItem) => {
      pressTimer.current = setTimeout(() => {
          setStoryPreview(feedItem);
      }, 400); // 400ms long press to peek
  };

  const handleStoryPressEnd = () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      setStoryPreview(null);
  };

  const toggleMemberSelection = (id) => {
    setSelectedMembers(prev => prev?.includes(id) ? prev.filter(m => m !== id) : [...(prev || []), id]);
  };

  const handleCreateGroup = async () => {
    if (groupName.length < 3) return toast.error("Group name must be at least 3 characters.");
    if (selectedMembers.length < 1) return toast.error("Please select at least 1 member.");
    
    try {
        const allMembers = [...selectedMembers, currentUser._id];
        
        console.log(`[Crypto] Generating AES Group Key for ${allMembers.length} members...`);

        const aesKeyJwk = await generateGroupAESKey();
        const aesKeyString = JSON.stringify(aesKeyJwk); 
        
        const keyPromises = allMembers.map(async (userId) => {
            try {
                const pkResponse = await axios.get(`${publicKeyRoute}/${userId}`, { headers: { "x-auth-token": currentUser.token }, withCredentials: true });
                
                if (pkResponse.data.status && pkResponse.data.bundle) {
                    const userPublicKey = pkResponse.data.bundle.identityKey;
                    return { userId, encryptedKey: await encryptMessage(aesKeyString, userPublicKey) };
                }
            } catch (err) {
                console.warn(`[Crypto] Failed to fetch key for user ${userId}`);
            }
            return null; 
        });

        const resolvedKeys = await Promise.all(keyPromises);
        const groupKeys = resolvedKeys.filter(k => k !== null);

        const { data } = await axios.post(createGroupRoute, { name: groupName, members: allMembers, admin: currentUser._id, groupKeys }, { headers: { "x-auth-token": currentUser.token }, withCredentials: true });
        if (data.status) {
            setGroups([...groups, data.group]); 
            setShowGroupModal(false); setGroupName(""); setSelectedMembers([]);
            toast.success("Group created successfully.");
        }
    } catch (error) { 
        console.error("[API] Failed to create group", error);
        toast.error("Failed to create group. Please try again."); 
    }
  };

  const handleJoinChannel = async (channelId) => {
      try {
          const { data } = await axios.post(joinChannelRoute, { channelId }, { headers: { "x-auth-token": currentUser.token }, withCredentials: true });
          if (data.status) {
              toast.success("Joined channel.");
              setShowDiscoverModal(false);
              setGroups(prev => [...prev, data.channel]);
          }
      } catch (error) { 
          toast.error(error.response?.data?.msg || "Failed to join channel."); 
      }
  };

  const handleUpdateProfile = async () => {
      try {
          const interestsArray = profileData.interests ? profileData.interests.split(",").map(i => i.trim()).filter(i => i !== "") : [];
          const { data } = await axios.post(`${updateProfileRoute}/${currentUser._id}`, { ...profileData, interests: interestsArray }, { headers: { "x-auth-token": currentUser.token }, withCredentials: true });
          
          if(data.status) {
              sessionStorage.setItem("chat-app-user", JSON.stringify(data.user));
              toast.success("Profile updated.");
              setShowProfileModal(false);
              setTimeout(() => window.location.reload(), 1000); 
          }
      } catch (error) { 
          console.error("[API] Failed to update profile.", error);
          toast.error("Failed to update profile."); 
      }
  };

  const getAvatarUrl = (user) => {
      if (user?.avatarImage) {
          if (!user.avatarImage.startsWith("http") && !user.avatarImage.startsWith("data:")) return `https://avatar.iran.liara.run/public/${user.avatarImage}`;
          return user.avatarImage; 
      }
      const seed = user?.username || 'default';
      const tops = user?.gender === 'female' ? femaleTops : maleTops;
      return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&top=${tops}&backgroundColor=${backgroundColors}`;
  };

  const unreadPersonalChatsCount = (contacts || []).filter(c => c.unreadCount > 0).length;
  const unreadGroupsCount = (groups || []).filter(g => g.unreadCount > 0).length;
  const totalUnreadChatsCount = unreadPersonalChatsCount + unreadGroupsCount;

  // Dynamic Filtering (Smart Folders logic)
  const displayedItems = useMemo(() => {
    let all = [
      ...(contacts || []).map(c => ({ ...c, isGroup: false })),
      ...(groups || []).map(g => ({ ...g, isGroup: true, username: g.name }))
    ];

    if (searchTerm) all = all.filter(item => item.username?.toLowerCase()?.includes(searchTerm.toLowerCase()));
    if (activeFolder === "personal") all = all.filter(i => !i.isGroup);
    if (activeFolder === "groups") all = all.filter(i => i.isGroup);
    if (activeFolder === "unread") all = all.filter(i => i.unreadCount > 0); 

    // Priority Sort: Pinned -> Online -> Alphabetical
    return all.sort((a, b) => {
      const aPinned = pinnedIds?.includes(a._id);
      const bPinned = pinnedIds?.includes(b._id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      
      const aOnline = !a.isGroup && onlineUsers?.includes(a._id);
      const bOnline = !b.isGroup && onlineUsers?.includes(b._id);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;

      return (a.username || "").localeCompare(b.username || "");
    });
  }, [contacts, groups, searchTerm, activeFolder, pinnedIds, onlineUsers]);

  // Segmented Control Data
  const folders = [
      { id: 'all', icon: <MdOutlineAllInclusive />, title: 'All', badge: totalUnreadChatsCount },
      { id: 'personal', icon: <BsChatDotsFill size={14} />, title: 'Personal', badge: unreadPersonalChatsCount },
      { id: 'groups', icon: <BsPeopleFill />, title: 'Groups', badge: unreadGroupsCount },
      { id: 'unread', icon: <FaRegEnvelope size={14} />, title: 'Unread', badge: totalUnreadChatsCount, danger: true }
  ];

  return (
    <>
      {currentUserName && (
        <Container $isCompact={isCompact} $themeType={theme}>
          
          <div className="brand" style={{ justifyContent: isCompact ? 'center' : 'space-between' }}>
            {!isCompact && <h3>Snappy</h3>}
            <button className="collapse-btn" onClick={() => setIsCompact(!isCompact)} title="Toggle Sidebar">
                {isCompact ? <FaChevronRight /> : <FaChevronLeft />}
            </button>
          </div>

          <AnimatePresence>
            {storyPreview && (
                <StoryPreviewTooltip 
                    initial={{ opacity: 0, y: 10, scale: 0.9 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.9 }}
                >
                    <img src={storyPreview.stories?.[0]?.mediaUrl || getAvatarUrl(storyPreview.user)} alt="preview" />
                    <div className="info">
                        <h4>{storyPreview.user?.username}</h4>
                        <p>{storyPreview.stories?.length} status update{storyPreview.stories?.length > 1 ? 's' : ''}</p>
                    </div>
                </StoryPreviewTooltip>
            )}
          </AnimatePresence>

          {!isCompact && (
              <>
                  <StoryTray>
                      <motion.div className="story-item my-status" onClick={() => fileInputRef.current?.click()} whileHover={{scale: 1.05}} whileTap={{scale: 0.95}}>
                          <div className="story-ring empty">
                              <img src={getAvatarUrl(currentUser)} alt="my-status" />
                              <div className="add-icon">{isUploadingStory ? <FaSpinner className="fa-spin" /> : <FaPlus />}</div>
                          </div>
                          <p>My Status</p>
                          <input type="file" hidden ref={fileInputRef} accept="image/*,video/*" onChange={handleStoryUpload} />
                      </motion.div>
                      
                      {(storyFeed || []).map((feedItem, index) => {
                          const hasUnread = feedItem.stories?.some(s => !s.viewers?.some(v => v.userId === currentUser._id));
                          return (
                              <motion.div 
                                  key={index} 
                                  className="story-item" 
                                  onClick={() => openStoryViewer(feedItem)}
                                  onMouseDown={() => handleStoryPressStart(feedItem)}
                                  onMouseUp={handleStoryPressEnd}
                                  onMouseLeave={handleStoryPressEnd}
                                  onTouchStart={() => handleStoryPressStart(feedItem)}
                                  onTouchEnd={handleStoryPressEnd}
                                  whileHover={{scale: 1.05}} 
                                  whileTap={{scale: 0.95}}
                              >
                                  <motion.div layoutId={`story-avatar-${feedItem.user?._id}`} className={`story-ring ${hasUnread ? 'unread' : 'read'}`}>
                                      <img src={getAvatarUrl(feedItem.user)} alt="status" />
                                  </motion.div>
                                  <p>{feedItem.user?.username}</p>
                              </motion.div>
                          );
                      })}
                  </StoryTray>
                  
                  <div className="folders-wrapper">
                      <div className="segmented-control">
                          {folders.map(f => (
                              <button 
                                  key={f.id} 
                                  className={`segment-btn ${activeFolder === f.id ? 'active' : ''}`}
                                  onClick={() => setActiveFolder(f.id)}
                                  title={f.title}
                              >
                                  {activeFolder === f.id && <motion.div layoutId="active-pill" className="active-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                                  <span className="content">
                                      {f.icon}
                                      {f.badge > 0 && <span className={`badge ${f.danger ? 'danger' : ''}`}>{f.badge}</span>}
                                  </span>
                              </button>
                          ))}
                      </div>
                  </div>

                  <div className={`search-container ${isSearchFocused ? 'focused' : ''}`}>
                      <motion.div className="search-box" animate={{ borderColor: isSearchFocused ? 'var(--msg-sent)' : 'var(--glass-border)' }}>
                          <FaSearch className="icon search-icon"/>
                          <input 
                              type="text" placeholder={`Search ${activeFolder}...`} 
                              value={searchTerm} 
                              onChange={(e) => setSearchTerm(e.target.value)}
                              onFocus={() => setIsSearchFocused(true)}
                              onBlur={() => setIsSearchFocused(false)}
                          />
                          <AnimatePresence>
                              {searchTerm && (
                                  <motion.div initial={{scale:0, rotate:-90}} animate={{scale:1, rotate:0}} exit={{scale:0, rotate:90}} className="icon clear-icon" onClick={() => setSearchTerm("")}>
                                      <FaTimes />
                                  </motion.div>
                              )}
                          </AnimatePresence>
                      </motion.div>
                  </div>
              </>
          )}

          <div className="contacts-list">
            {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="contact-item skeleton">
                        <div className="avatar skeleton-anim" />
                        {!isCompact && (
                            <div className="details">
                                <div className="skeleton-line skeleton-anim" />
                                <div className="skeleton-line short skeleton-anim" />
                            </div>
                        )}
                    </div>
                ))
            ) : (
              <>
                {!isCompact && activeFolder === "groups" && !searchTerm && (
                    <div className="group-actions">
                        <button className="primary" onClick={() => setShowGroupModal(true)}><FaPlus /> Create</button>
                        <button className="secondary" onClick={() => setShowDiscoverModal(true)}><FaGlobe /> Discover</button>
                    </div>
                )}
                
                {!isCompact && searchTerm.length >= 3 && <div className="section-title">Chats & Groups</div>}

                {displayedItems.length === 0 && !searchTerm && !isCompact ? (
                    <div className="empty-state">No chats found.</div>
                ) : (
                    displayedItems.map((item) => {
                        const isOnline = !item.isGroup && onlineUsers?.includes(item._id);
                        const isPinned = pinnedIds?.includes(item._id);
                        const isTyping = !item.isGroup && globalTypingUsers?.includes(item._id);
                        const isSelected = item._id === currentSelected;

                        return (
                            <ContactItem 
                              key={item._id} 
                              className={`${isSelected ? "selected" : ""} ${isPinned ? "pinned" : ""}`} 
                              onClick={() => changeCurrentChat(item, item.isGroup)}
                              $isCompact={isCompact}
                              title={isCompact ? item.username : ""}
                            >
                                <div className="avatar">
                                    {item.isGroup ? <div className="group-avatar">#</div> : <img src={getAvatarUrl(item)} alt="avatar" />}
                                    {isOnline && <div className="online-badge" />}
                                    {isCompact && item.unreadCount > 0 && <span className="compact-badge">{item.unreadCount}</span>}
                                </div>
                                
                                {!isCompact && (
                                    <>
                                        <div className="details">
                                            <h3>{item.username}</h3>
                                            {item.isGroup ? (
                                                <p className="status group">Group Chat</p>
                                            ) : (
                                                <div className="presence">
                                                    {isTyping ? (
                                                        <div className="typing-indicator">
                                                            <motion.span animate={{y:[0,-3,0]}} transition={{repeat:Infinity, duration:0.6, delay:0}} />
                                                            <motion.span animate={{y:[0,-3,0]}} transition={{repeat:Infinity, duration:0.6, delay:0.2}} />
                                                            <motion.span animate={{y:[0,-3,0]}} transition={{repeat:Infinity, duration:0.6, delay:0.4}} />
                                                            <span className="text">typing</span>
                                                        </div>
                                                    ) : (
                                                        <p className={`status ${isOnline ? 'online' : ''}`}>{isOnline ? "Online" : formatLastSeen(item.lastSeen)}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="meta">
                                          <button className="pin-btn" onClick={(e) => togglePin(e, item._id)}>
                                            <FaThumbtack />
                                          </button>
                                          {item.unreadCount > 0 && <span className="unread-count">{item.unreadCount}</span>}
                                        </div>
                                    </>
                                )}
                            </ContactItem>
                        );
                    })
                )}

                {!isCompact && searchTerm.length >= 3 && (
                    <>
                        <div className="section-title">Message History</div>
                        {isSearchingGlobal ? (
                            <div className="empty-state"><FaSpinner className="fa-spin" /> Searching...</div>
                        ) : globalMessages.length === 0 ? (
                            <div className="empty-state">No matching messages.</div>
                        ) : (
                            globalMessages.map(msg => {
                                const msgText = msg.message?.text || msg.message;
                                if (typeof msgText === 'string' && msgText.length > 50 && !msgText.includes(" ")) return null;

                                return (
                                    <div key={msg._id} className="global-msg" onClick={() => handleGlobalMessageClick(msg)}>
                                        <p>"{msgText}"</p>
                                        <span>{new Date(msg.createdAt).toLocaleDateString()}</span>
                                    </div>
                                );
                            })
                        )}
                    </>
                )}
              </>
            )}
          </div>

          <div className="user-footer" style={{ padding: isCompact ? '16px 8px' : '16px', justifyContent: isCompact ? 'center' : 'flex-start' }}>
             <div className="user-profile" style={{ flexDirection: isCompact ? 'column' : 'row', gap: isCompact ? '16px' : '12px' }}>
                 <div className="avatar" style={{ margin: isCompact ? '0 auto' : '0' }}>
                     <img src={getAvatarUrl(currentUser)} alt="avatar" />
                 </div>
                 
                 {!isCompact && (
                     <div className="info">
                         <h2>{currentUserName}</h2>
                         <p>{currentUser?.statusIcon || "✨"} {currentUser?.statusMessage || "Available"}</p>
                     </div>
                 )}
                 <div className="actions" style={{ flexDirection: isCompact ? 'column' : 'row' }}>
                     {!isCompact && <button onClick={() => setTheme(theme === 'light' ? 'glass' : 'light')} title="Toggle Theme">{theme === 'light' ? <FaMoon /> : <FaSun />}</button>}
                     <button onClick={() => setShowProfileModal(true)} title="Settings"><FaCog /></button>
                     <button className="logout" onClick={handleLogout} title="Logout"><FaSignOutAlt /></button>
                 </div>
             </div>
          </div>

          {/* --- PREMIUM MODALS --- */}
          <AnimatePresence>
              {showGroupModal && (
                  <ModalOverlay as={motion.div} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                      <motion.div className="modal-content" initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
                          <h3>Create Secure Group</h3>
                          <div className="input-field">
                              <label>Group Name</label>
                              <input type="text" placeholder="e.g. Project Alpha" value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus />
                          </div>
                          <div className="member-selection">
                              <label>Select Members</label>
                              <div className="scroll-list">
                                  {(contacts || []).map(c => (
                                      <div key={c._id} className={`select-item ${selectedMembers?.includes(c._id) ? "selected" : ""}`} onClick={() => toggleMemberSelection(c._id)}>
                                          <img src={getAvatarUrl(c)} alt=""/>
                                          <span>{c.username}</span>
                                          {selectedMembers?.includes(c._id) && <FaCheck className="check"/>}
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div className="button-group">
                              <button className="btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
                              <button className="btn-primary" onClick={handleCreateGroup}>Create Group</button>
                          </div>
                      </motion.div>
                  </ModalOverlay>
              )}

              {showDiscoverModal && (
                <ModalOverlay as={motion.div} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <motion.div className="modal-content" initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
                        <h3>Discover Channels</h3>
                        <div className="input-field">
                            <FaSearch className="inner-icon"/>
                            <input type="text" placeholder="Search public channels..." value={channelSearchQuery} onChange={(e) => setChannelSearchQuery(e.target.value)} autoFocus style={{paddingLeft: '40px'}}/>
                        </div>
                        
                        <div className="member-selection" style={{minHeight: '200px'}}>
                            {isSearchingChannels ? (
                                <div className="center-loading"><FaSpinner className="fa-spin"/></div>
                            ) : discoveredChannels.length > 0 ? (
                                <div className="scroll-list">
                                    {discoveredChannels.map(channel => (
                                        <div key={channel._id} className="channel-item">
                                            <div className="info">
                                                <h4>{channel.name}</h4>
                                                <p>{channel.members?.length} subscribers</p>
                                            </div>
                                            <button className="btn-primary small" onClick={() => handleJoinChannel(channel._id)}>Join</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                channelSearchQuery.length > 0 && <p className="empty-text">No channels found.</p>
                            )}
                        </div>
                        <div className="button-group">
                            <button className="btn-secondary full-width" onClick={() => {setShowDiscoverModal(false); setChannelSearchQuery("");}}>Close</button>
                        </div>
                    </motion.div>
                </ModalOverlay>
              )}

              {showProfileModal && (
                  <ModalOverlay as={motion.div} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                      <motion.div className="modal-content profile" initial={{scale:0.9, y:20}} animate={{scale:1, y:0}} exit={{scale:0.9, y:20}}>
                          <h3>Profile & Settings</h3>
                          
                          <div className="grid-2">
                              <div className="input-field">
                                  <label>Theme</label>
                                  <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                                      <option value="glass">Glassmorphism</option>
                                      <option value="midnight">Midnight (OLED)</option>
                                      <option value="cyberpunk">Cyberpunk</option>
                                      <option value="light">Light Mode</option>
                                  </select>
                              </div>
                              <div className="input-field">
                                  <label>Compact Mode</label>
                                  <button className={`toggle-btn ${isCompact ? 'on' : ''}`} onClick={() => setIsCompact(!isCompact)}>
                                      {isCompact ? "Enabled" : "Disabled"}
                                  </button>
                              </div>
                          </div>

                          <div className="section-divider"><FaShieldAlt /> Privacy & Security</div>
                          
                          <div className="grid-2">
                              <div className="input-field">
                                  <label>Last Seen</label>
                                  <select value={profileData.privacySettings.lastSeen} onChange={(e) => setProfileData({...profileData, privacySettings: {...profileData.privacySettings, lastSeen: e.target.value}})}>
                                      <option value="everyone">Everyone</option><option value="nobody">Nobody</option>
                                  </select>
                              </div>
                              <div className="input-field">
                                  <label>Profile Photo</label>
                                  <select value={profileData.privacySettings.profilePhoto} onChange={(e) => setProfileData({...profileData, privacySettings: {...profileData.privacySettings, profilePhoto: e.target.value}})}>
                                      <option value="everyone">Everyone</option><option value="nobody">Nobody</option>
                                  </select>
                              </div>
                          </div>

                          <div className="setting-row">
                              <div className="text">
                                  <label>Read Receipts</label>
                                  <p>Show blue ticks when you read messages.</p>
                              </div>
                              <div className={`ios-switch ${profileData.privacySettings.readReceipts ? 'on' : 'off'}`} onClick={() => setProfileData({...profileData, privacySettings: {...profileData.privacySettings, readReceipts: !profileData.privacySettings.readReceipts}})}>
                                  <div className="knob" />
                              </div>
                          </div>

                          <div className="setting-row">
                              <div className="text">
                                  <label>App Lock (PIN)</label>
                                  <p>Require a 4-digit PIN to open the app.</p>
                              </div>
                              <div className={`ios-switch ${hasPin ? 'on' : 'off'}`} onClick={() => {
                                  if (hasPin) { 
                                      localStorage.removeItem("app-pin-code"); 
                                      setHasPin(false); 
                                      toast.info("App Lock disabled."); 
                                  } 
                                  else {
                                      const newPin = prompt("Enter a 4-digit PIN:");
                                      if (newPin && newPin.length === 4 && !isNaN(newPin)) { 
                                          localStorage.setItem("app-pin-code", newPin); 
                                          setHasPin(true); 
                                          toast.success("App Lock enabled."); 
                                      } 
                                      else if (newPin) toast.error("Invalid PIN. Please enter 4 numbers.");
                                  }
                              }}>
                                  <div className="knob" />
                              </div>
                          </div>

                          <div className="section-divider">Public Profile</div>
                          
                          <div className="input-field multi">
                              <label>Status Icon & Message</label>
                              <div className="flex-row">
                                <input type="text" maxLength="2" value={profileData.statusIcon} onChange={(e) => setProfileData({...profileData, statusIcon: e.target.value})} style={{width: '60px', textAlign: 'center'}}/>
                                <input type="text" placeholder="What's on your mind?" maxLength="50" value={profileData.statusMessage} onChange={(e) => setProfileData({...profileData, statusMessage: e.target.value})} style={{flex: 1}}/>
                              </div>
                          </div>
                          <div className="input-field">
                              <label>Bio</label>
                              <textarea placeholder="Tell people about yourself..." value={profileData.bio} onChange={(e) => setProfileData({...profileData, bio: e.target.value})} />
                          </div>
                          
                          <div className="button-group" style={{marginTop: '20px'}}>
                              <button className="btn-secondary" onClick={() => setShowProfileModal(false)}>Cancel</button>
                              <button className="btn-primary" onClick={handleUpdateProfile}>Save Changes</button>
                          </div>
                      </motion.div>
                  </ModalOverlay>
              )}
          </AnimatePresence>
          {/* UPDATED TOAST CONTAINER FOR IOS STYLE */}
          <ToastContainer 
              position="top-center" 
              autoClose={3000} 
              hideProgressBar={true} 
              newestOnTop={true} 
              closeOnClick 
              rtl={false} 
              pauseOnFocusLoss 
              draggable 
              pauseOnHover 
              theme={theme === 'light' ? 'light' : 'dark'} 
          />
        </Container>
      )}
    </>
  );
}

// --- MASSIVE PREMIUM STYLING ARCHITECTURE ---
const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: ${({ $isCompact }) => $isCompact ? '85px' : '100%'};
  transition: width 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  background: transparent;
  border-right: 1px solid var(--glass-border);
  overflow: hidden;
  
  ${({ $themeType }) => $themeType === 'cyberpunk' && css`border-color: #10b981;`}

  /* Typography Baseline */
  h2, h3, h4, p, span, label { font-family: 'Inter', sans-serif; margin: 0; }

  /* 1. Header */
  .brand {
    flex-shrink: 0; padding: 24px 24px 16px;
    display: flex; align-items: center;
    h3 { color: var(--text-main); font-size: 1.4rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
    .collapse-btn {
        background: var(--input-bg); border: none; color: var(--text-dim); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s; 
        &:hover { color: var(--text-main); background: var(--msg-sent); }
    }
  }

  /* 2. Folders (Segmented Control) */
  .folders-wrapper {
      flex-shrink: 0; padding: 0 16px 16px;
      .segmented-control {
          display: flex; background: var(--input-bg); padding: 4px; border-radius: 16px; border: 1px solid var(--glass-border);
          .segment-btn {
              flex: 1; position: relative; background: transparent; border: none; padding: 8px 0; border-radius: 12px; cursor: pointer; color: var(--text-dim); transition: color 0.3s;
              &.active { color: var(--text-main); }
              .active-pill { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg-panel); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 0; border: 1px solid var(--glass-border); }
              .content { position: relative; z-index: 1; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; }
              .badge { position: absolute; top: -6px; right: 10px; background: var(--msg-sent); color: white; font-size: 0.6rem; font-weight: bold; padding: 2px 6px; border-radius: 10px; border: 2px solid var(--input-bg);
                  &.danger { background: #ff4e4e; }
              }
          }
      }
  }

  /* 3. Search Bar */
  .search-container {
      flex-shrink: 0; padding: 0 16px 16px; transition: padding 0.3s;
      &.focused { padding-bottom: 24px; }
      .search-box {
          display: flex; align-items: center; background: var(--input-bg); border-radius: 16px; padding: 0 16px; border: 1px solid var(--glass-border); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          .icon { color: var(--text-dim); font-size: 0.9rem; }
          .clear-icon { cursor: pointer; transition: 0.2s; &:hover { color: var(--text-main); } }
          input { flex: 1; background: transparent; border: none; padding: 12px 12px; color: var(--text-main); font-size: 0.9rem; outline: none; }
      }
  }

  /* 4. Contact List */
  .contacts-list {
      flex: 1; overflow-y: auto; overflow-x: hidden; padding: 0 12px; display: flex; flex-direction: column; gap: 4px;
      &::-webkit-scrollbar { width: 4px; display: ${({ $isCompact }) => $isCompact ? 'none' : 'block'}; }
      &::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 4px; }

      .section-title { font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin: 16px 8px 8px; letter-spacing: 0.5px; }
      .empty-state { text-align: center; color: var(--text-dim); padding: 32px 0; font-style: italic; font-size: 0.9rem; }

      .group-actions {
          display: flex; gap: 8px; padding: 0 4px 8px;
          button { flex: 1; display: flex; justify-content: center; align-items: center; gap: 8px; padding: 12px; border-radius: 12px; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: 0.2s; }
          .primary { background: linear-gradient(135deg, var(--msg-sent), #9a41fe); color: white; box-shadow: 0 4px 15px rgba(78, 14, 255, 0.3); &:hover { filter: brightness(1.1); transform: translateY(-2px); } }
          .secondary { background: var(--input-bg); color: var(--text-main); border: 1px solid var(--glass-border); &:hover { background: var(--bg-panel); transform: translateY(-2px); } }
      }

      .contact-item.skeleton {
          display: flex; gap: 12px; padding: 12px; pointer-events: none;
          .avatar { width: 48px; height: 48px; border-radius: 50%; }
          .details { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
          .skeleton-line { height: 12px; border-radius: 6px; width: 60%; }
          .short { width: 40%; }
          .skeleton-anim { background: linear-gradient(90deg, var(--input-bg) 25%, var(--bg-panel) 50%, var(--input-bg) 75%); background-size: 200% 100%; animation: ${shimmer} 1.5s infinite linear; }
      }

      .global-msg {
          background: var(--input-bg); padding: 12px; border-radius: 12px; cursor: pointer; border: 1px solid var(--glass-border); transition: 0.2s;
          &:hover { border-color: var(--msg-sent); transform: translateY(-2px); }
          p { color: var(--text-main); font-size: 0.85rem; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          span { font-size: 0.7rem; color: var(--text-dim); display: block; margin-top: 4px; text-align: right; }
      }
  }

  /* 5. User Footer */
  .user-footer {
      flex-shrink: 0; padding: 16px; border-top: 1px solid var(--glass-border); background: var(--bg-panel);
      .user-profile {
          display: flex; align-items: center; gap: 12px;
          .avatar { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--msg-sent); img { width:100%; height:100%; object-fit:cover; border-radius: 50%; } }
          .info { flex: 1; overflow: hidden; h2 { font-size: 0.95rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } p { font-size: 0.75rem; color: var(--adaptive-accent); margin-top: 2px; font-weight: 500;} }
          .actions {
              display: flex; gap: 4px;
              button { background: var(--input-bg); color: var(--text-dim); width: 36px; height: 36px; border-radius: 10px; border: none; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: 0.2s;
                  &:hover { background: var(--msg-sent); color: white; transform: translateY(-2px); }
                  &.logout:hover { background: #ff4e4e; }
              }
          }
      }
  }
`;

const ContactItem = styled.div`
  display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 16px; cursor: pointer;
  background: transparent; border: 1px solid transparent; transition: all 0.2s ease; position: relative;
  justify-content: ${({ $isCompact }) => $isCompact ? 'center' : 'flex-start'};

  &:hover { background: linear-gradient(90deg, var(--input-bg) 0%, transparent 100%); transform: ${({ $isCompact }) => $isCompact ? 'scale(1.1)' : 'none'}; }
  &.selected { background: var(--input-bg); border-color: var(--glass-border); box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
  &.pinned { border-left: 3px solid var(--msg-sent); }

  .avatar {
      position: relative; width: 48px; height: 48px; flex-shrink: 0;
      img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; background: var(--bg-panel); }
      .group-avatar { width: 100%; height: 100%; border-radius: 50%; background: var(--input-bg); display: flex; justify-content: center; align-items: center; color: var(--msg-sent); font-size: 1.2rem; font-weight: 800; }
      .online-badge { position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: #10b981; border-radius: 50%; border: 2px solid var(--bg-panel); box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
      .compact-badge { position: absolute; top: -4px; right: -4px; background: #ff4e4e; color: white; font-size: 0.65rem; font-weight: bold; width: 18px; height: 18px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 2px solid var(--bg-panel); }
  }

  .details {
      flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center;
      h3 { font-size: 0.95rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
      .presence {
          .status { font-size: 0.8rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
              &.online { color: #10b981; }
              &.group { color: var(--msg-sent); font-weight: 500; }
          }
          .typing-indicator {
              display: flex; align-items: center; gap: 3px;
              span { width: 4px; height: 4px; background: var(--msg-sent); border-radius: 50%; display: inline-block; }
              .text { font-size: 0.75rem; color: var(--msg-sent); font-style: italic; background: none; width: auto; height: auto; margin-left: 4px; font-weight: 600;}
          }
      }
  }

  .meta {
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0;
      .pin-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; opacity: 0; font-size: 0.9rem; &:hover { color: var(--text-main); transform: scale(1.2); } }
      .unread-count { background: var(--msg-sent); color: white; font-size: 0.7rem; font-weight: bold; padding: 2px 8px; border-radius: 12px; box-shadow: 0 2px 8px rgba(78, 14, 255, 0.4); }
  }
  
  &:hover .pin-btn { opacity: 1; }
  &.pinned .pin-btn { opacity: 1; color: var(--msg-sent); }
`;

const StoryTray = styled.div`
  flex-shrink: 0; display: flex; gap: 16px; padding: 0 20px 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; border-bottom: 1px solid var(--glass-border);
  &::-webkit-scrollbar { display: none; }

  .story-item {
      display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; min-width: 64px;
      p { font-size: 0.7rem; color: var(--text-main); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 64px; text-align: center; }
      
      .story-ring {
          width: 60px; height: 60px; border-radius: 50%; padding: 3px; position: relative;
          background: var(--glass-border);
          
          img { width: 100%; height: 100%; border-radius: 50%; border: 3px solid var(--bg-panel); object-fit: cover; }
          
          &.unread { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); box-shadow: 0 4px 15px rgba(220, 39, 67, 0.3); }
          &.empty { background: none; border: 2px dashed var(--glass-border); padding: 2px; }
          
          .add-icon { position: absolute; bottom: -2px; right: -2px; background: var(--msg-sent); color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; border: 3px solid var(--bg-panel); }
      }
  }
`;

const StoryPreviewTooltip = styled(motion.div)`
  position: absolute; top: 130px; left: 20px;
  background: var(--bg-panel); backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border); border-radius: 16px;
  padding: 12px; display: flex; align-items: center; gap: 12px;
  z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,0.15);

  img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; }
  .info {
      h4 { color: var(--text-main); font-size: 0.9rem; margin-bottom: 4px; }
      p { color: var(--text-dim); font-size: 0.75rem; }
  }
`;

const ModalOverlay = styled.div`
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); z-index: 1000; display: flex; justify-content: center; align-items: center;

  .modal-content {
      background: var(--bg-panel); border: 1px solid var(--glass-border); border-radius: 24px; padding: 32px; width: 440px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 10px; }
      
      &.profile { width: 500px; }

      h3 { font-size: 1.4rem; color: var(--text-main); font-weight: 700; margin-bottom: 24px; text-align: center; }
      .section-divider { margin: 24px 0 16px; font-size: 0.85rem; text-transform: uppercase; color: var(--msg-sent); font-weight: 700; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; }

      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

      .input-field {
          margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; position: relative;
          label { font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--text-dim); letter-spacing: 0.5px; }
          .inner-icon { position: absolute; bottom: 14px; left: 14px; color: var(--text-dim); font-size: 1rem; }
          input, select, textarea { width: 100%; background: var(--input-bg); border: 1px solid var(--glass-border); color: var(--text-main); padding: 12px 16px; border-radius: 12px; font-family: inherit; font-size: 0.95rem; transition: 0.2s; outline: none; &:focus { border-color: var(--msg-sent); background: var(--bg-panel); box-shadow: 0 0 0 3px rgba(78,14,255,0.1); } }
          textarea { resize: none; height: 100px; }
          .flex-row { display: flex; gap: 12px; }
      }

      .setting-row {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; background: var(--input-bg); padding: 16px; border-radius: 16px; border: 1px solid var(--glass-border);
          .text { label { color: var(--text-main); font-weight: 600; font-size: 0.95rem; } p { color: var(--text-dim); font-size: 0.8rem; margin-top: 4px; } }
      }

      /* iOS Style Switch */
      .ios-switch { width: 50px; height: 30px; border-radius: 30px; background: var(--glass-border); position: relative; cursor: pointer; transition: 0.3s; 
          .knob { position: absolute; top: 2px; left: 2px; width: 26px; height: 26px; background: white; border-radius: 50%; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
          &.on { background: #10b981; .knob { left: 22px; } }
      }

      .toggle-btn { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-main); font-weight: 600; cursor: pointer; transition: 0.2s; &.on { background: var(--msg-sent); border-color: var(--msg-sent); color: white; box-shadow: 0 4px 15px rgba(78,14,255,0.3); } }

      .member-selection {
          background: var(--input-bg); border-radius: 16px; border: 1px solid var(--glass-border); overflow: hidden; margin-bottom: 24px;
          label { display: block; padding: 12px 16px; background: var(--bg-panel); font-size: 0.8rem; font-weight: 600; color: var(--text-dim); border-bottom: 1px solid var(--glass-border); text-transform: uppercase; }
          .scroll-list { max-height: 200px; overflow-y: auto; &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-thumb { background: var(--glass-border); } }
          .select-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--glass-border); cursor: pointer; transition: 0.2s; img { width: 32px; height: 32px; border-radius: 50%; } span { flex: 1; font-weight: 500; color: var(--text-main); } .check { color: var(--msg-sent); } &:hover { background: var(--bg-panel); } &.selected { background: rgba(78,14,255,0.1); } }
          
          .channel-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--glass-border); .info { h4 { color: var(--text-main); font-size: 1rem; } p { color: var(--text-dim); font-size: 0.8rem; margin-top: 4px; } } }
          .center-loading { display: flex; justify-content: center; align-items: center; height: 100px; font-size: 1.5rem; color: var(--msg-sent); }
          .empty-text { text-align: center; color: var(--text-dim); padding: 32px; font-style: italic; }
      }

      .button-group {
          display: flex; gap: 12px;
          button { flex: 1; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: 0.2s; border: none; display: flex; justify-content: center; align-items: center; }
          .btn-primary { background: linear-gradient(135deg, var(--msg-sent), #9a41fe); color: white; box-shadow: 0 6px 20px rgba(78, 14, 255, 0.3); &:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(78, 14, 255, 0.4); filter: brightness(1.1); } }
          .btn-secondary { background: transparent; border: 1px solid var(--glass-border); color: var(--text-main); &:hover { background: var(--input-bg); } }
          .small { padding: 8px 16px; flex: none; border-radius: 20px; font-size: 0.85rem;}
          .full-width { flex: 1; width: 100%; }
      }
  }
`;