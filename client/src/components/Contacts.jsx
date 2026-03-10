import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import { 
    FaUserFriends, FaPlus, FaSearch, FaCog, FaThumbtack, 
    FaRegEnvelope, FaTimes, FaSpinner, FaShieldAlt, FaEye, FaGlobe,
    FaSun, FaMoon // <-- Theme Icons
} from "react-icons/fa";
import { BsChatDotsFill, BsPeopleFill } from "react-icons/bs";
import { MdOutlineAllInclusive } from "react-icons/md";
import axios from "axios";
import { 
    host, createGroupRoute, getUserGroupsRoute, updateProfileRoute, 
    searchMessageRoute, getStoryFeedRoute, addStoryRoute, viewStoryRoute,
    searchChannelsRoute, joinChannelRoute 
} from "../utils/APIRoutes";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- IMPORT ZUSTAND STORE & CRYPTO ---
import useChatStore from "../store/chatStore";
import { generateGroupAESKey, encryptMessage } from "../utils/crypto"; 

// Safe API constants for Fallback avatar generation
const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

// Helper function to format the Last Seen timestamp dynamically
const formatLastSeen = (dateString) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Last seen just now";
    if (diffMins < 60) return `Last seen ${diffMins}m ago`;
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    if (diffDays === 1) return "Last seen yesterday";
    if (diffDays < 7) return `Last seen ${diffDays}d ago`;
    
    return `Last seen ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}`;
};

export default function Contacts({ 
  contacts, 
  changeChat, 
  handleLogout
}) {
  
  const {
      currentUser,
      onlineUsers,
      theme,
      setTheme, // <-- Controls theme
      isCompact,
      setIsCompact,
      globalTypingUsers
  } = useChatStore();

  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  
  const [activeFolder, setActiveFolder] = useState("all"); 
  
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
        const saved = localStorage.getItem(`pinned-chats-${currentUser?._id}`);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
  });

  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  const [globalMessages, setGlobalMessages] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [discoveredChannels, setDiscoveredChannels] = useState([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);

  const [profileData, setProfileData] = useState({
      statusIcon: "✨", 
      statusMessage: "Available", 
      bio: "", 
      interests: "",
      privacySettings: {
          lastSeen: "everyone",
          readReceipts: true,
          profilePhoto: "everyone"
      }
  });

  const [hasPin, setHasPin] = useState(!!localStorage.getItem("app-pin-code"));

  // --- STORY SYSTEM STATE ---
  const [storyFeed, setStoryFeed] = useState([]);
  const [viewingStoryUser, setViewingStoryUser] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchGroupsAndStories = async () => {
      if(currentUser && currentUser.token) {
          try {
              const groupRes = await axios.get(getUserGroupsRoute, {
                  headers: { "x-auth-token": currentUser.token }
              });
              setGroups(groupRes.data);

              const storyRes = await axios.get(getStoryFeedRoute, {
                  headers: { "x-auth-token": currentUser.token }
              });
              if(storyRes.data.status) {
                  setStoryFeed(storyRes.data.feed);
              }
          } catch (error) { 
              console.error("Error fetching data:", error); 
          } finally {
              setIsLoading(false);
          }
      }
    };

    if (currentUser) {
      setCurrentUserName(currentUser.username);
      
      setProfileData({
          statusIcon: currentUser.statusIcon || "✨",
          statusMessage: currentUser.statusMessage || "Available",
          bio: currentUser.bio || "",
          interests: currentUser.interests ? currentUser.interests.join(", ") : "",
          privacySettings: currentUser.privacySettings || {
              lastSeen: "everyone",
              readReceipts: true,
              profilePhoto: "everyone"
          }
      });
      fetchGroupsAndStories();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`pinned-chats-${currentUser._id}`, JSON.stringify(pinnedIds));
    }
  }, [pinnedIds, currentUser]);

  useEffect(() => {
      let timer;
      if (viewingStoryUser && viewingStoryUser.stories) {
          timer = setTimeout(() => {
              handleNextStory();
          }, 5000); 
      }
      return () => clearTimeout(timer);
  }, [viewingStoryUser, currentStoryIndex]);

  useEffect(() => {
      if (!searchTerm || searchTerm.length < 3) {
          setGlobalMessages([]);
          return;
      }
      
      const delayDebounceFn = setTimeout(async () => {
          setIsSearchingGlobal(true);
          try {
              const { data } = await axios.post(searchMessageRoute, {
                  userId: currentUser._id,
                  query: searchTerm
              }, {
                  headers: { "x-auth-token": currentUser.token }
              });
              
              if (data.status) {
                  setGlobalMessages(data.messages);
              }
          } catch (error) {
              console.error("Error searching messages:", error);
          } finally {
              setIsSearchingGlobal(false);
          }
      }, 600);

      return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentUser]);

  useEffect(() => {
      if (!channelSearchQuery) {
          setDiscoveredChannels([]);
          return;
      }
      const delayDebounceFn = setTimeout(async () => {
          setIsSearchingChannels(true);
          try {
              const { data } = await axios.get(`${searchChannelsRoute}?query=${channelSearchQuery}`, {
                  headers: { "x-auth-token": currentUser.token }
              });
              if (data.status) setDiscoveredChannels(data.channels);
          } catch (error) { console.error(error); } 
          finally { setIsSearchingChannels(false); }
      }, 500);
      return () => clearTimeout(delayDebounceFn);
  }, [channelSearchQuery, currentUser]);

  const togglePin = useCallback((e, id) => {
    e.stopPropagation(); 
    setPinnedIds((prev) => {
        if (prev.includes(id)) {
            toast.info("Chat unpinned");
            return prev.filter(pid => pid !== id);
        } else {
            if (prev.length >= 5) {
                toast.warning("Maximum 5 pins allowed");
                return prev;
            }
            toast.success("Chat pinned to top");
            return [...prev, id];
        }
    });
  }, []);

  const changeCurrentChat = useCallback((contact, isGroup = false) => {
    setCurrentSelected(contact._id);
    changeChat(contact, isGroup); 
  }, [changeChat]);

  const handleGlobalMessageClick = (msg) => {
      let targetChat = null;
      let isGroupChat = false;

      targetChat = groups.find(g => msg.users.includes(g._id));
      if (targetChat) {
          isGroupChat = true;
      } else {
          const otherUserId = msg.users.find(id => id !== currentUser._id);
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
              const { data } = await axios.post(addStoryRoute, {
                  mediaUrl: reader.result,
                  mediaType: file.type.startsWith("video") ? "video" : "image"
              }, { headers: { "x-auth-token": currentUser.token } });

              if (data.status) {
                  toast.success("Status updated!");
                  const storyRes = await axios.get(getStoryFeedRoute, { headers: { "x-auth-token": currentUser.token } });
                  setStoryFeed(storyRes.data.feed);
              }
          } catch (err) { 
              toast.error("Failed to upload status."); 
          } finally { 
              setIsUploadingStory(false); 
          }
      };
  };

  const openStoryViewer = async (userFeedObj) => {
      setViewingStoryUser(userFeedObj);
      setCurrentStoryIndex(0);

      const firstStory = userFeedObj.stories[0];
      if (firstStory.user._id !== currentUser._id) {
          try {
              await axios.post(`${viewStoryRoute}/${firstStory._id}`, {}, { headers: { "x-auth-token": currentUser.token } });
          } catch (error) { console.error("Failed to mark story as viewed"); }
      }
  };

  const handleNextStory = async () => {
      if (!viewingStoryUser) return;
      if (currentStoryIndex < viewingStoryUser.stories.length - 1) {
          const nextIdx = currentStoryIndex + 1;
          setCurrentStoryIndex(nextIdx);
          
          const nextStory = viewingStoryUser.stories[nextIdx];
          if (nextStory.user._id !== currentUser._id) {
              try {
                  await axios.post(`${viewStoryRoute}/${nextStory._id}`, {}, { headers: { "x-auth-token": currentUser.token } });
              } catch (error) { console.error("Failed to mark story as viewed"); }
          }
      } else {
          setViewingStoryUser(null); 
      }
  };

  const displayedItems = useMemo(() => {
    let all = [
      ...contacts.map(c => ({ ...c, isGroup: false })),
      ...groups.map(g => ({ ...g, isGroup: true, username: g.name }))
    ];

    if (searchTerm) {
      all = all.filter(item => item.username.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (activeFolder === "personal") all = all.filter(i => !i.isGroup);
    if (activeFolder === "groups") all = all.filter(i => i.isGroup);
    if (activeFolder === "unread") all = all.filter(i => i.unreadCount > 0); 

    return all.sort((a, b) => {
      const aPinned = pinnedIds.includes(a._id);
      const bPinned = pinnedIds.includes(b._id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      
      const aOnline = onlineUsers.includes(a._id);
      const bOnline = onlineUsers.includes(b._id);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;

      return a.username.localeCompare(b.username);
    });
  }, [contacts, groups, searchTerm, activeFolder, pinnedIds, onlineUsers]);

  const toggleMemberSelection = (id) => {
    if (selectedMembers.includes(id)) setSelectedMembers(selectedMembers.filter(m => m !== id));
    else setSelectedMembers([...selectedMembers, id]);
  };

  const handleCreateGroup = async () => {
    if (groupName.length < 3) return toast.error("Group name must be > 3 characters");
    if (selectedMembers.length < 1) return toast.error("Select at least 1 member");
    
    try {
        const allMembers = [...selectedMembers, currentUser._id];
        toast.info("Generating secure E2EE keys...", { autoClose: 2000 });

        const aesKeyJwk = await generateGroupAESKey();
        const aesKeyString = JSON.stringify(aesKeyJwk); 
        
        const keyPromises = allMembers.map(async (userId) => {
            try {
                const pkResponse = await axios.get(`${host}/api/auth/public-key/${userId}`, {
                    headers: { "x-auth-token": currentUser.token }
                });
                const userPublicKey = pkResponse.data.publicKey;
                
                if (userPublicKey) {
                    const encryptedKey = await encryptMessage(aesKeyString, userPublicKey);
                    return { userId, encryptedKey };
                }
            } catch (err) {
                console.error(`Could not fetch public key for user ${userId}`);
            }
            return null; 
        });

        const resolvedKeys = await Promise.all(keyPromises);
        const groupKeys = resolvedKeys.filter(k => k !== null);

        const { data } = await axios.post(createGroupRoute, {
            name: groupName, 
            members: allMembers, 
            admin: currentUser._id,
            groupKeys 
        }, {
            headers: { "x-auth-token": currentUser.token }
        });
        
        if (data.status) {
            setGroups([...groups, data.group]); 
            setShowGroupModal(false); setGroupName(""); setSelectedMembers([]);
            toast.success("Secure Group created successfully!");
        }
    } catch (error) { 
        toast.error("Failed to create secure group"); 
        console.error(error);
    }
  };

  const handleJoinChannel = async (channelId) => {
      try {
          const { data } = await axios.post(joinChannelRoute, { channelId }, {
              headers: { "x-auth-token": currentUser.token }
          });
          if (data.status) {
              toast.success("Joined channel successfully!");
              setShowDiscoverModal(false);
              setGroups(prev => [...prev, data.channel]);
          }
      } catch (error) {
          toast.error(error.response?.data?.msg || "Failed to join channel.");
      }
  };

  const handleUpdateProfile = async () => {
      try {
          const interestsArray = profileData.interests 
            ? profileData.interests.split(",").map(i => i.trim()).filter(i => i !== "") 
            : [];
            
          const { data } = await axios.post(`${updateProfileRoute}/${currentUser._id}`, {
              ...profileData, 
              interests: interestsArray
          }, {
              headers: { "x-auth-token": currentUser.token }
          });
          
          if(data.status) {
              sessionStorage.setItem("chat-app-user", JSON.stringify(data.user));
              toast.success("Profile and Settings updated!");
              setShowProfileModal(false);
              setTimeout(() => window.location.reload(), 1000); 
          }
      } catch (error) { 
          toast.error("Failed to update profile. Your session may have expired."); 
      }
  };

  const getAvatarUrl = (user) => {
      if (user?.avatarImage) {
          if (!user.avatarImage.startsWith("http") && !user.avatarImage.startsWith("data:")) {
              return `https://avatar.iran.liara.run/public/${user.avatarImage}`;
          }
          return user.avatarImage; 
      }
      const seed = user?.username || 'default';
      const isFemale = user?.gender === 'female';
      const tops = isFemale ? femaleTops : maleTops;
      return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&top=${tops}&backgroundColor=${backgroundColors}`;
  };

  // --- THEME TOGGLE HANDLER ---
  const toggleTheme = () => {
      if (theme === 'light') {
          setTheme('glass');
      } else {
          setTheme('light');
      }
  };

  const unreadPersonalChatsCount = contacts.filter(c => c.unreadCount > 0).length;
  const unreadGroupsCount = groups.filter(g => g.unreadCount > 0).length;
  const totalUnreadChatsCount = unreadPersonalChatsCount + unreadGroupsCount;

  return (
    <>
      {currentUserName && (
        <Container $isCompact={isCompact} $themeType={theme}>
          <div className="brand glass-shine-effect">
            <h3>Snappy</h3>
          </div>

          <StoryTray className="story-tray">
              <div className="story-item my-status" onClick={() => fileInputRef.current.click()}>
                  <div className="story-ring empty">
                      <img src={getAvatarUrl(currentUser)} alt="my-status" />
                      <div className="add-icon">{isUploadingStory ? <FaSpinner className="fa-spin" /> : <FaPlus />}</div>
                  </div>
                  <p>My Status</p>
                  <input type="file" hidden ref={fileInputRef} accept="image/*,video/*" onChange={handleStoryUpload} />
              </div>
              
              {storyFeed.map((feedItem, index) => {
                  const hasUnread = feedItem.stories.some(s => !s.viewers.some(v => v.userId === currentUser._id));
                  return (
                      <div key={index} className="story-item" onClick={() => openStoryViewer(feedItem)}>
                          <div className={`story-ring ${hasUnread ? 'unread' : 'read'}`}>
                              <img src={getAvatarUrl(feedItem.user)} alt="status" />
                          </div>
                          <p>{feedItem.user.username}</p>
                      </div>
                  );
              })}
          </StoryTray>
          
          <div className="folders-bar">
            <FolderBtn className={activeFolder === "all" ? "active" : ""} onClick={() => setActiveFolder("all")} title="All Conversations">
                <MdOutlineAllInclusive />
                {totalUnreadChatsCount > 0 && <span className="badge theme-badge">{totalUnreadChatsCount}</span>}
            </FolderBtn>
            <FolderBtn className={activeFolder === "personal" ? "active" : ""} onClick={() => setActiveFolder("personal")} title="Personal">
                <BsChatDotsFill />
                {unreadPersonalChatsCount > 0 && <span className="badge theme-badge">{unreadPersonalChatsCount}</span>}
            </FolderBtn>
            <FolderBtn className={activeFolder === "groups" ? "active" : ""} onClick={() => setActiveFolder("groups")} title="Groups">
                <BsPeopleFill />
                {unreadGroupsCount > 0 && <span className="badge theme-badge">{unreadGroupsCount}</span>}
            </FolderBtn>
            <FolderBtn className={activeFolder === "unread" ? "active" : ""} onClick={() => setActiveFolder("unread")} title="Unread">
                <FaRegEnvelope />
                {totalUnreadChatsCount > 0 && <span className="badge danger-badge">{totalUnreadChatsCount}</span>}
            </FolderBtn>
          </div>

          <div className="search-bar">
             <FaSearch className="search-icon"/>
             <input type="text" placeholder={`Search ${activeFolder}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             {searchTerm && (
                 <FaTimes className="clear-icon" onClick={() => setSearchTerm("")} title="Clear search" />
             )}
          </div>

          <div className="contacts">
            {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="contact skeleton-box">
                        {!isCompact && <div className="avatar skeleton-anim" />}
                        <div className="username">
                            <div className="skeleton-line skeleton-anim" />
                            <div className="skeleton-line short skeleton-anim" />
                        </div>
                    </div>
                ))
            ) : (
              <>
                {activeFolder === "groups" && !searchTerm && (
                    <div style={{display:'flex', gap:'10px', width: '92%', marginBottom: '10px'}}>
                        <div className="create-group-btn" style={{flex: 1, width: 'auto'}} onClick={() => setShowGroupModal(true)}><FaPlus /> Create</div>
                        <div className="create-group-btn" style={{flex: 1, width: 'auto', background: 'linear-gradient(90deg, #34B7F1, #00ff88)'}} onClick={() => setShowDiscoverModal(true)}><FaGlobe /> Discover</div>
                    </div>
                )}
                
                {searchTerm.length >= 3 && <div className="search-section-title">Chats & Groups</div>}

                {displayedItems.length === 0 && !searchTerm ? (
                    <div className="empty-state">No chats found.</div>
                ) : (
                    displayedItems.map((item) => {
                        const isOnline = !item.isGroup && onlineUsers.includes(item._id);
                        const isPinned = pinnedIds.includes(item._id);
                        const isTyping = !item.isGroup && globalTypingUsers.includes(item._id);

                        return (
                            <ContactItem 
                              key={item._id} 
                              className={`contact ${item._id === currentSelected ? "selected" : ""}`} 
                              onClick={() => changeCurrentChat(item, item.isGroup)}
                              $isCompact={isCompact}
                              $themeType={theme}
                              $selected={item._id === currentSelected}
                              $isPinned={isPinned}
                            >
                                {!isCompact && (
                                    <div className="avatar">
                                        {item.isGroup ? <div className="group-avatar">#</div> : <img src={getAvatarUrl(item)} alt="avatar" />}
                                    </div>
                                )}
                                
                                <div className="username">
                                    <h3>{item.username}</h3>
                                    {item.isGroup ? (
                                        <p className="status-text group-text">Group Chat</p>
                                    ) : (
                                        <div className="presence-container">
                                            {isTyping ? (
                                                <p className="status-text typing-text">typing...</p>
                                            ) : (
                                                <p className="status-text">
                                                    {isOnline ? (
                                                        <span className="online-text">Online</span>
                                                    ) : (
                                                        <span className="offline-text">{formatLastSeen(item.lastSeen)}</span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="contact-meta">
                                  {isOnline && <div className="online-indicator" />}
                                  {item.unreadCount > 0 && <span style={{backgroundColor: '#00ff88', color: '#000', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold'}}>{item.unreadCount}</span>}
                                  
                                  <button className={`pin-btn ${isPinned ? "pinned" : ""}`} onClick={(e) => togglePin(e, item._id)}>
                                    <FaThumbtack />
                                  </button>
                                </div>
                            </ContactItem>
                        );
                    })
                )}

                {searchTerm.length >= 3 && (
                    <>
                        <div className="search-section-title">Message History</div>
                        {isSearchingGlobal ? (
                            <div className="empty-state"><FaSpinner className="fa-spin" /> Searching DB...</div>
                        ) : globalMessages.length === 0 ? (
                            <div className="empty-state">No matching messages.</div>
                        ) : (
                            globalMessages.map(msg => {
                                const msgText = msg.message?.text || msg.message;
                                const isEncryptedBlob = typeof msgText === 'string' && msgText.length > 50 && !msgText.includes(" ");
                                if (isEncryptedBlob) return null;

                                return (
                                    <div key={msg._id} className="global-msg-item" onClick={() => handleGlobalMessageClick(msg)}>
                                        <p className="msg-text">"{msgText}"</p>
                                        <span className="msg-date">{new Date(msg.createdAt).toLocaleDateString()}</span>
                                    </div>
                                );
                            })
                        )}
                    </>
                )}
              </>
            )}
          </div>

          <div className="current-user">
             <div className="user-info">
                 {!isCompact && (
                     <div className="current-user-avatar">
                         <img src={getAvatarUrl(currentUser)} alt="avatar" />
                     </div>
                 )}
                 <div className="details">
                     <h2>{currentUserName}</h2>
                     <p className="status-text">{currentUser?.statusIcon || "✨"} {currentUser?.statusMessage || "Available"}</p>
                 </div>
                 <div className="actions">
                     {/* --- THEME BUTTON --- */}
                     <button className="theme-btn" onClick={toggleTheme} title="Toggle Light/Dark Mode">
                         {theme === 'light' ? <FaMoon size={16}/> : <FaSun size={16}/>}
                     </button>
                     <button className="profile-btn" onClick={() => setShowProfileModal(true)} title="Settings & Profile"><FaCog size={16}/></button>
                     <button className="logout-btn" onClick={handleLogout} title="Logout"><FaTimes size={16}/></button>
                 </div>
             </div>
          </div>

          {showGroupModal && (
              <Modal>
                  <div className="modal-content">
                      <h3>Create Group</h3>
                      <input type="text" placeholder="Group Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                      <div className="member-select">
                          <h4>Select Members:</h4>
                          {contacts.map(contact => (
                              <div key={contact._id} className={`select-item ${selectedMembers.includes(contact._id) ? "selected" : ""}`} onClick={() => toggleMemberSelection(contact._id)}>{contact.username}</div>
                          ))}
                      </div>
                      <div className="modal-actions">
                          <button onClick={handleCreateGroup}>Create</button>
                          <button className="cancel" onClick={() => setShowGroupModal(false)}>Cancel</button>
                      </div>
                  </div>
              </Modal>
          )}

          {showDiscoverModal && (
            <Modal>
                <div className="modal-content profile-modal">
                    <h3>Discover Channels</h3>
                    <div className="input-group">
                        <input 
                            type="text" 
                            placeholder="Search for public channels..." 
                            value={channelSearchQuery} 
                            onChange={(e) => setChannelSearchQuery(e.target.value)} 
                            autoFocus
                        />
                    </div>
                    
                    <div className="member-select" style={{ minHeight: '200px' }}>
                        {isSearchingChannels ? (
                            <div style={{textAlign: 'center', marginTop: '20px'}}><FaSpinner className="fa-spin" color="var(--msg-sent)"/></div>
                        ) : discoveredChannels.length > 0 ? (
                            discoveredChannels.map(channel => (
                                <div key={channel._id} style={{
                                    display:'flex', justifyContent:'space-between', alignItems:'center', 
                                    background:'var(--input-bg)', padding:'10px', borderRadius:'10px', marginBottom:'10px'
                                }}>
                                    <div style={{flex: 1}}>
                                        <h4 style={{margin:0, color:'var(--msg-sent)', fontSize:'1rem'}}>{channel.name}</h4>
                                        <p style={{margin:'4px 0 0 0', fontSize:'0.75rem', color:'var(--text-dim)'}}>{channel.members?.length} subscribers</p>
                                    </div>
                                    <button onClick={() => handleJoinChannel(channel._id)} style={{
                                        background:'var(--msg-sent)', color:'white', border:'none', padding:'6px 12px', 
                                        borderRadius:'20px', cursor:'pointer', fontWeight:'bold'
                                    }}>Join</button>
                                </div>
                            ))
                        ) : (
                            channelSearchQuery.length > 0 && <p style={{textAlign:'center', color:'var(--text-dim)'}}>No channels found.</p>
                        )}
                    </div>
                    
                    <div className="modal-actions">
                        <button className="cancel" style={{width: '100%'}} onClick={() => {setShowDiscoverModal(false); setChannelSearchQuery("");}}>Close</button>
                    </div>
                </div>
            </Modal>
          )}

          {showProfileModal && (
              <Modal>
                  <div className="modal-content profile-modal">
                      <h3>Settings & Profile</h3>
                      <div className="settings-row">
                          <div className="input-group">
                              <label>Theme Engine</label>
                              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                                  <option value="glass">Glassmorphism</option>
                                  <option value="midnight">Midnight (OLED)</option>
                                  <option value="cyberpunk">Cyberpunk</option>
                                  <option value="light">Light Mode</option>
                              </select>
                          </div>
                          <div className="input-group">
                              <label>Compact Mode</label>
                              <button className={`toggle-btn ${isCompact ? 'active' : ''}`} onClick={() => setIsCompact(!isCompact)}>
                                  {isCompact ? "Enabled" : "Disabled"}
                              </button>
                          </div>
                      </div>

                      <hr className="divider" />
                      <h4 style={{ color: 'var(--msg-sent)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FaShieldAlt /> Privacy & Security
                      </h4>
                      <div className="settings-row">
                          <div className="input-group">
                              <label>Last Seen</label>
                              <select 
                                  value={profileData.privacySettings.lastSeen} 
                                  onChange={(e) => setProfileData({...profileData, privacySettings: {...profileData.privacySettings, lastSeen: e.target.value}})}
                              >
                                  <option value="everyone">Everyone</option>
                                  <option value="nobody">Nobody</option>
                              </select>
                          </div>
                          <div className="input-group">
                              <label>Profile Photo</label>
                              <select 
                                  value={profileData.privacySettings.profilePhoto} 
                                  onChange={(e) => setProfileData({...profileData, privacySettings: {...profileData.privacySettings, profilePhoto: e.target.value}})}
                              >
                                  <option value="everyone">Everyone</option>
                                  <option value="nobody">Nobody</option>
                              </select>
                          </div>
                      </div>
                      <div className="input-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                          <div>
                              <label style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 'bold' }}>Read Receipts</label>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>If turned off, you won't send or receive blue ticks.</p>
                          </div>
                          <button 
                              className={`toggle-btn ${profileData.privacySettings.readReceipts ? 'active' : ''}`} 
                              style={{ width: 'auto', padding: '0.5rem 1rem' }}
                              onClick={() => setProfileData({...profileData, privacySettings: {...profileData.privacySettings, readReceipts: !profileData.privacySettings.readReceipts}})}
                          >
                              {profileData.privacySettings.readReceipts ? "Enabled" : "Disabled"}
                          </button>
                      </div>
                      <div className="input-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                          <div>
                              <label style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 'bold' }}>App Lock (PIN)</label>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>Require a 4-digit PIN to open the app.</p>
                          </div>
                          <button 
                              className={`toggle-btn ${hasPin ? 'active' : ''}`} 
                              style={{ width: 'auto', padding: '0.5rem 1rem' }}
                              onClick={() => {
                                  if (hasPin) {
                                      localStorage.removeItem("app-pin-code");
                                      setHasPin(false);
                                      toast.info("App Lock Disabled");
                                  } else {
                                      const newPin = prompt("Enter a 4-digit PIN to lock your app:");
                                      if (newPin && newPin.length === 4 && !isNaN(newPin)) {
                                          localStorage.setItem("app-pin-code", newPin);
                                          setHasPin(true);
                                          toast.success("App Lock Enabled! It will activate next time you open the app.");
                                      } else if (newPin) {
                                          toast.error("Invalid PIN. Must be exactly 4 numbers.");
                                      }
                                  }
                              }}
                          >
                              {hasPin ? "Disable" : "Setup PIN"}
                          </button>
                      </div>

                      <hr className="divider" />
                      <h4 style={{ color: 'var(--msg-sent)', marginBottom: '15px' }}>Public Profile</h4>
                      <div className="input-group">
                          <label>Status Icon & Message</label>
                          <div style={{display:'flex', gap:'10px'}}>
                            <input type="text" maxLength="2" value={profileData.statusIcon} onChange={(e) => setProfileData({...profileData, statusIcon: e.target.value})} style={{width: '60px'}}/>
                            <input type="text" placeholder="Status..." maxLength="50" value={profileData.statusMessage} onChange={(e) => setProfileData({...profileData, statusMessage: e.target.value})} />
                          </div>
                      </div>
                      <div className="input-group">
                          <label>Short Bio</label>
                          <textarea placeholder="Tell people about yourself..." maxLength="150" value={profileData.bio} onChange={(e) => setProfileData({...profileData, bio: e.target.value})} />
                      </div>
                      <div className="input-group">
                          <label>Interests (Comma separated)</label>
                          <input type="text" placeholder="Coding, Music, Gaming..." value={profileData.interests} onChange={(e) => setProfileData({...profileData, interests: e.target.value})} />
                      </div>

                      <hr className="divider" />
                      <div className="modal-actions">
                          <button onClick={handleUpdateProfile}>Save Changes</button>
                          <button className="cancel" onClick={() => setShowProfileModal(false)}>Cancel</button>
                      </div>
                  </div>
              </Modal>
          )}

          {viewingStoryUser && (
              <StoryViewerOverlay onClick={(e) => { if(e.target === e.currentTarget) setViewingStoryUser(null); }}>
                  <div className="viewer-content">
                      <div className="progress-bars">
                          {viewingStoryUser.stories.map((s, i) => (
                              <div key={i} className="bar-bg">
                                  <div className="bar-fill" style={{ 
                                      width: i < currentStoryIndex ? '100%' : i === currentStoryIndex ? '100%' : '0%',
                                      transition: i === currentStoryIndex ? 'width 5s linear' : 'none'
                                  }} />
                              </div>
                          ))}
                      </div>
                      
                      <div className="viewer-header">
                          <img src={getAvatarUrl(viewingStoryUser.user)} alt="avatar" />
                          <div>
                              <h4>{viewingStoryUser.user.username}</h4>
                              <p>{formatLastSeen(viewingStoryUser.stories[currentStoryIndex].createdAt)}</p>
                          </div>
                          <button onClick={() => setViewingStoryUser(null)}><FaTimes /></button>
                      </div>

                      <div className="media-container" onClick={handleNextStory}>
                          {viewingStoryUser.stories[currentStoryIndex].mediaType === "video" ? (
                              <video src={viewingStoryUser.stories[currentStoryIndex].mediaUrl} autoPlay muted />
                          ) : (
                              <img src={viewingStoryUser.stories[currentStoryIndex].mediaUrl} alt="story" />
                          )}
                      </div>

                      {viewingStoryUser.user._id === currentUser._id && (
                          <div className="viewers-count">
                              <FaEye /> {viewingStoryUser.stories[currentStoryIndex].viewers.length} Views
                          </div>
                      )}
                  </div>
              </StoryViewerOverlay>
          )}

          <ToastContainer position="bottom-left" theme={theme === 'light' ? 'light' : 'dark'} />
        </Container>
      )}
    </>
  );
}

// --- STYLES & ANIMATIONS ---
const shimmer = keyframes`
  0% { background-position: -468px 0; }
  100% { background-position: 468px 0; }
`;

const glassShine = keyframes`
  0% { left: -100%; opacity: 0; }
  50% { opacity: 0.3; }
  100% { left: 100%; opacity: 0; }
`;

const Container = styled.div`
  display: grid; 
  grid-template-rows: 8% 13% 7.5% 8% 48.5% 15%; 
  height: 100%; 
  width: 100%; 
  overflow: hidden; 
  background: transparent; 
  border-right: 1px solid var(--glass-border);
  
  /* Retain specific theme overwrites if needed, otherwise CSS variables handle it */
  ${({ $themeType }) => $themeType === 'cyberpunk' && css` border-right: 1px solid #00ff88; `}

  .brand { 
    display: flex; align-items: center; justify-content: center; position: relative;
    h3 { 
        color: var(--text-main); 
        text-transform: uppercase; letter-spacing: 0.3rem; font-weight: 700; 
        ${({ $isCompact }) => $isCompact && css`font-size: 1rem;`} 
    } 
  }

  .glass-shine-effect {
    overflow: hidden;
    &::after {
      content: ""; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
      background: linear-gradient(90deg, transparent, var(--glass-border), transparent);
      transform: skewX(-25deg); animation: ${glassShine} 4s infinite linear;
    }
  }

  .folders-bar {
      display: flex; justify-content: space-around; align-items: center;
      padding: 0 1rem; border-bottom: 1px solid var(--glass-border);
  }

  .search-bar { 
      display: flex; align-items: center; justify-content: center; padding: 0 1.2rem; position: relative; 
      .search-icon { position: absolute; left: 2.2rem; color: var(--text-dim); font-size: 0.9rem; } 
      .clear-icon { position: absolute; right: 2.2rem; color: var(--text-dim); font-size: 0.9rem; cursor: pointer; transition: 0.2s; &:hover { color: var(--text-main); transform: scale(1.1); } }
      input { 
          width: 100%; background: var(--input-bg); border: 1px solid var(--glass-border); padding: 0.6rem 2.8rem; border-radius: 1.2rem; color: var(--text-main); outline: none; transition: 0.3s; font-size: 0.9rem; 
          &:focus { border-color: var(--msg-sent); box-shadow: 0 0 10px rgba(78, 14, 255, 0.1); } 
      } 
  }
  
  .contacts {
    display: flex; flex-direction: column; align-items: center; 
    height: 100%; width: 100%; overflow-y: auto; overflow-x: hidden; 
    gap: 0.8rem; padding: 1.2rem 0.6rem;
    
    &::-webkit-scrollbar { width: 4px; } 
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background-color: var(--glass-border); border-radius: 10px; }
    
    .empty-state { color: var(--text-dim); font-style: italic; margin-top: 2rem; font-size: 0.9rem; }
    
    .create-group-btn { width: 92%; background: linear-gradient(90deg, var(--msg-sent), #9a86f3); padding: 0.9rem; text-align: center; border-radius: 0.8rem; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; gap: 0.6rem; font-weight: bold; font-size: 0.9rem; flex-shrink: 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: 0.3s; &:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(78, 14, 255, 0.3); filter: brightness(1.1); } }
    
    .skeleton-box { background: var(--glass-bg) !important; border: none !important; cursor: default; flex-shrink: 0; &:hover { transform: none; } }
    .skeleton-anim { background: var(--bg-panel); background-image: linear-gradient(to right, var(--bg-panel) 0%, var(--glass-border) 20%, var(--bg-panel) 40%, var(--bg-panel) 100%); background-repeat: no-repeat; background-size: 800px 100%; animation: ${shimmer} 1.5s infinite linear forwards; }
    .skeleton-line { height: 12px; width: 100px; border-radius: 4px; margin-bottom: 6px; }
    .skeleton-line.short { width: 60px; height: 10px; }

    .search-section-title {
        width: 90%; text-transform: uppercase; color: var(--text-dim); font-size: 0.75rem; 
        font-weight: 700; margin: 15px 0 5px 0; letter-spacing: 1px; flex-shrink: 0;
    }
    
    .global-msg-item {
        background: var(--glass-bg); width: 90%; padding: 0.8rem; 
        border-radius: 0.8rem; cursor: pointer; transition: 0.3s;
        border: 1px solid var(--glass-border); flex-shrink: 0;
        
        &:hover { background: var(--input-bg); border-color: var(--msg-sent); transform: translateY(-2px); }
        .msg-text { color: var(--text-main); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-style: italic;}
        .msg-date { color: var(--text-dim); font-size: 0.65rem; display: block; margin-top: 6px; text-align: right;}
    }
  }

  .current-user {
      background: var(--glass-bg); padding: 1.2rem; display: flex; justify-content: center; align-items: center;
      border-top: 1px solid var(--glass-border); height: 100%; 

      .user-info {
          display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 12px;
          .current-user-avatar { height: 2.8rem; min-width: 2.8rem; width: 2.8rem; border-radius: 50%; overflow: hidden; border: 2px solid var(--msg-sent); img { width: 100%; height: 100%; object-fit: cover; } }
          
          .details { 
              display: flex; flex-direction: column; flex-grow: 1; 
              h2 { color: var(--text-main); font-size: 1.1rem; font-weight: 600; margin: 0;} 
              .status-text { margin: 0; color: #00ff88; font-size: 0.75rem; font-weight: 500; } 
          }
          
          .actions { 
              display: flex; gap: 0.6rem; align-items: center; 
              button { border: none; border-radius: 0.6rem; cursor: pointer; font-size: 0.8rem; font-weight: bold; padding: 0.5rem 0.9rem; display: flex; align-items: center; justify-content: center; transition: 0.3s; } 
              .theme-btn { background: var(--input-bg); color: var(--text-main); &:hover { background: var(--msg-sent); color: white; transform: rotate(15deg); } }
              .profile-btn { background: var(--input-bg); color: var(--msg-sent); &:hover { background: var(--msg-sent); color: white; transform: rotate(90deg); } } 
              .logout-btn { background: rgba(255, 78, 78, 0.1); color: #ff4e4e; &:hover { background: #ff4e4e; color: white; } } 
          }
      }
  }
`;

const ContactItem = styled.div`
  background: var(--glass-bg); 
  padding: ${({ $isCompact }) => $isCompact ? '0.5rem' : '0.8rem'}; 
  width: 90%; flex-shrink: 0; 
  border-radius: 1rem; display: flex; align-items: center; gap: 1rem; 
  cursor: pointer; border: 1px solid transparent; position: relative;
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden; 

  ${({ $isPinned }) => $isPinned && css`
    background: var(--input-bg); border-left: 3.5px solid var(--msg-sent);
  `}

  &:hover { 
    background: var(--input-bg); 
    transform: scale(1.03) translateY(-2px); 
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    .pin-btn { opacity: 1; }
  }

  ${({ $selected }) => $selected && css`
      background: var(--input-bg); 
      border-color: var(--msg-sent);
      transform: scale(1.02);
  `}

  .avatar { 
    height: 3rem; width: 3rem; min-width: 3rem; border-radius: 50%; overflow: hidden; 
    display: flex; align-items: center; justify-content: center; 
    background: var(--bg-panel); transition: box-shadow 0.3s ease;
    img { width: 100%; height: 100%; object-fit: cover; } 
    .group-avatar { font-weight: bold; color: var(--msg-sent); font-size: 1.3rem; }
    ${({ $selected }) => $selected && css`box-shadow: 0 0 15px var(--glass-border);`}
  }

  .username { 
    flex-grow: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden; 
    h3 { color: var(--text-main); font-size: 0.95rem; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } 
    .presence-container { display: flex; align-items: center; gap: 5px; }
    .status-text { color: var(--text-dim); font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; } 
    .typing-text { color: #00ff88; font-style: italic; font-weight: 600; letter-spacing: 0.5px; animation: ${glassShine} 2s infinite linear; }
    .online-text { color: #00ff88; font-weight: 500; }
    .offline-text { color: var(--text-dim); font-style: italic; }
  }
  
  .contact-meta {
    display: flex; flex-direction: column; align-items: flex-end; gap: 8px; min-width: 20px; 
    .online-indicator { height: 8px; width: 8px; background: #00ff88; border-radius: 50%; box-shadow: 0 0 10px #00ff88; }
    .pin-btn {
      background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; font-size: 0.85rem;
      opacity: ${({ $isPinned }) => $isPinned ? 1 : 0};
      &:hover { color: var(--text-main); transform: scale(1.2); }
      &.pinned { color: var(--msg-sent); }
    }
  }
`;

const FolderBtn = styled.button`
    background: transparent; border: none; color: var(--text-dim); cursor: pointer;
    font-size: 1.2rem; display: flex; align-items: center; justify-content: center;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
    width: 42px; height: 42px; border-radius: 12px; position: relative;
    
    &:hover { color: var(--text-main); background: var(--input-bg); transform: translateY(-2px); }
    &.active { color: var(--msg-sent); background: var(--input-bg); box-shadow: 0 4px 10px rgba(0,0,0,0.1); transform: translateY(-2px); }

    .badge {
        position: absolute; top: -2px; right: -2px;
        color: white; font-size: 0.6rem; font-weight: bold;
        padding: 2px 5px; border-radius: 10px; border: 2px solid var(--bg-panel);
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .theme-badge { background: var(--msg-sent); }
    .danger-badge { background: #ff4e4e; }
`;

const Modal = styled.div`
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; 
    z-index: 100; backdrop-filter: blur(12px);
    .modal-content {
        background: var(--bg-panel); padding: 2.2rem; border-radius: 1.5rem; width: 440px;
        border: 1px solid var(--glass-border); box-shadow: 0 15px 40px rgba(0,0,0,0.2);
        max-height: 90vh; overflow-y: auto;
        
        &::-webkit-scrollbar { width: 4px; } 
        &::-webkit-scrollbar-track { background: transparent; }
        &::-webkit-scrollbar-thumb { background-color: var(--glass-border); border-radius: 10px; }

        h3 { color: var(--text-main); margin-bottom: 1.5rem; text-align: center; font-weight: 600; font-size: 1.3rem; }
        .divider { border-color: var(--glass-border); margin: 1.5rem 0; }
        .settings-row { display: flex; gap: 1rem; }
        select, input, textarea { width: 100%; padding: 0.9rem; margin-bottom: 0.8rem; background: var(--input-bg); border: 1px solid var(--glass-border); color: var(--text-main); border-radius: 0.8rem; font-family: inherit; transition: 0.3s; &:focus { outline: none; border-color: var(--msg-sent); } }
        .toggle-btn { padding: 0.9rem; background: var(--input-bg); color: var(--text-main); border: 1px solid var(--glass-border); border-radius: 0.8rem; cursor: pointer; width: 100%; transition: 0.3s; font-weight: 500;}
        .toggle-btn.active { background: var(--msg-sent); border-color: var(--msg-sent); color: white; box-shadow: 0 4px 15px rgba(78, 14, 255, 0.3); }
        textarea { resize: none; height: 95px; }
        .input-group { display: flex; flex-direction: column; flex: 1; label { color: var(--text-dim); font-size: 0.75rem; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05rem; } }
        .member-select { max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem; h4 { color: var(--text-dim); margin-bottom: 0.6rem; font-size: 0.8rem; text-transform: uppercase; } .select-item { padding: 0.75rem; color: var(--text-main); cursor: pointer; border-radius: 0.6rem; margin: 4px 0; transition: 0.2s; &:hover { background: var(--input-bg); } &.selected { background: var(--msg-sent); color: white; font-weight: 600; } } }
        .modal-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; button { padding: 0.8rem 2.4rem; border: none; border-radius: 0.8rem; cursor: pointer; background: var(--msg-sent); color: white; font-weight: bold; transition: 0.3s; &:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); } } .cancel { background: #ff4e4e; } }
    }
`;

const StoryTray = styled.div`
    display: flex; gap: 12px; padding: 0.8rem; overflow-x: auto; border-bottom: 1px solid var(--glass-border);
    &::-webkit-scrollbar { display: none; }
    
    .story-item {
        display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; min-width: 60px;
        p { color: var(--text-dim); font-size: 0.65rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px; text-align: center; }
        
        .story-ring {
            width: 52px; height: 52px; border-radius: 50%; padding: 2px; position: relative;
            background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
            
            img { width: 100%; height: 100%; border-radius: 50%; border: 2px solid var(--bg-panel); object-fit: cover; }
            
            &.read { background: var(--glass-bg); }
            &.empty { background: none; border: 1px dashed var(--glass-border); padding: 0; }
            
            .add-icon {
                position: absolute; bottom: 0; right: -2px; background: var(--msg-sent); color: white;
                border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
                font-size: 0.6rem; border: 2px solid var(--bg-panel);
            }
        }
    }
`;

const StoryViewerOverlay = styled.div`
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95);
    z-index: 999; display: flex; justify-content: center; align-items: center;
    
    .viewer-content {
        width: 100%; max-width: 450px; height: 90vh; background: #000; border-radius: 12px;
        position: relative; overflow: hidden; display: flex; flex-direction: column;
        
        .progress-bars {
            display: flex; gap: 5px; padding: 10px; position: absolute; top: 0; left: 0; width: 100%; z-index: 10;
            .bar-bg { flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden; }
            .bar-fill { height: 100%; background: #fff; width: 0%; }
        }

        .viewer-header {
            position: absolute; top: 20px; left: 0; width: 100%; padding: 10px 15px; z-index: 10;
            display: flex; align-items: center; gap: 10px; background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
            img { width: 35px; height: 35px; border-radius: 50%; border: 1px solid #fff; }
            div { flex: 1; h4 { color: #fff; font-size: 0.9rem; } p { color: #ccc; font-size: 0.7rem; } }
            button { background: none; border: none; color: #fff; font-size: 1.2rem; cursor: pointer; }
        }

        .media-container {
            flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer;
            img, video { max-width: 100%; max-height: 100%; object-fit: contain; }
        }
        
        .viewers-count {
            position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.6); padding: 5px 15px; border-radius: 20px;
            color: white; font-size: 0.8rem; display: flex; align-items: center; gap: 8px;
        }
    }
`;