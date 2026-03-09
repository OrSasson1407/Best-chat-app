import React, { useState, useEffect, useMemo, useCallback } from "react";
import styled, { keyframes, css } from "styled-components";
import { FaUserFriends, FaPlus, FaSearch, FaCog, FaThumbtack, FaRegEnvelope, FaTimes, FaSpinner, FaShieldAlt } from "react-icons/fa";
import { BsChatDotsFill, BsPeopleFill } from "react-icons/bs";
import { MdOutlineAllInclusive } from "react-icons/md";
import axios from "axios";
import { host, createGroupRoute, getUserGroupsRoute, updateProfileRoute, searchMessageRoute } from "../utils/APIRoutes";
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
      setTheme,
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

  useEffect(() => {
    const fetchGroups = async () => {
      if(currentUser && currentUser.token) {
          try {
              const { data } = await axios.get(getUserGroupsRoute, {
                  headers: { "x-auth-token": currentUser.token }
              });
              setGroups(data);
          } catch (error) { 
              console.error("Error fetching groups:", error); 
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
      fetchGroups();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`pinned-chats-${currentUser._id}`, JSON.stringify(pinnedIds));
    }
  }, [pinnedIds, currentUser]);

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

  // --- UNREAD COUNT LOGIC FIX ---
  // Calculates the number of INDIVIDUAL CHATS that have unread messages.
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
          
          <div className="folders-bar">
            {/* All Chats Badge */}
            <FolderBtn className={activeFolder === "all" ? "active" : ""} onClick={() => setActiveFolder("all")} title="All Conversations">
                <MdOutlineAllInclusive />
                {totalUnreadChatsCount > 0 && <span className="badge theme-badge">{totalUnreadChatsCount}</span>}
            </FolderBtn>
            
            {/* Personal Chats Badge */}
            <FolderBtn className={activeFolder === "personal" ? "active" : ""} onClick={() => setActiveFolder("personal")} title="Personal">
                <BsChatDotsFill />
                {unreadPersonalChatsCount > 0 && <span className="badge theme-badge">{unreadPersonalChatsCount}</span>}
            </FolderBtn>
            
            {/* Groups Chats Badge */}
            <FolderBtn className={activeFolder === "groups" ? "active" : ""} onClick={() => setActiveFolder("groups")} title="Groups">
                <BsPeopleFill />
                {unreadGroupsCount > 0 && <span className="badge theme-badge">{unreadGroupsCount}</span>}
            </FolderBtn>
            
            {/* Unread Folder Badge */}
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
                    <div className="create-group-btn" onClick={() => setShowGroupModal(true)}><FaPlus /> Create New Group</div>
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
                                  
                                  {/* Also display unread badge on the individual chat item if applicable */}
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
                     <button className="profile-btn" onClick={() => setShowProfileModal(true)} title="Settings & Profile"><FaCog size={16}/></button>
                     <button className="logout-btn" onClick={handleLogout}>Logout</button>
                 </div>
             </div>
          </div>

          {/* Group Creation Modal */}
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

          {/* Profile & Settings Modal */}
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
                      <h4 style={{ color: '#00ff88', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                              <label style={{ margin: 0, color: '#e0e0e0', fontSize: '0.85rem', fontWeight: 'bold' }}>Read Receipts</label>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>If turned off, you won't send or receive blue ticks.</p>
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
                              <label style={{ margin: 0, color: '#e0e0e0', fontSize: '0.85rem', fontWeight: 'bold' }}>App Lock (PIN)</label>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>Require a 4-digit PIN to open the app.</p>
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
                      <h4 style={{ color: '#34B7F1', marginBottom: '15px' }}>Public Profile</h4>
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

          <ToastContainer position="bottom-left" theme="dark" />
        </Container>
      )}
    </>
  );
}

// --- STYLES & ANIMATIONS (Unchanged) ---
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
  grid-template-rows: 10% 7.5% 8.5% 59% 15%; 
  height: 100%; 
  width: 100%; 
  overflow: hidden; 
  background: rgba(0, 0, 0, 0.2); 
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  
  ${({ $themeType }) => $themeType === 'cyberpunk' && css` border-right: 1px solid #00ff88; `}
  ${({ $themeType }) => $themeType === 'midnight' && css` background: #000; border-right: 1px solid #333; `}

  .brand { 
    display: flex; align-items: center; justify-content: center; position: relative;
    h3 { color: #fff; text-transform: uppercase; letter-spacing: 0.3rem; font-weight: 700; ${({ $isCompact }) => $isCompact && css`font-size: 1rem;`} } 
  }

  .glass-shine-effect {
    overflow: hidden;
    &::after {
      content: ""; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
      transform: skewX(-25deg); animation: ${glassShine} 4s infinite linear;
    }
  }

  .folders-bar {
      display: flex; justify-content: space-around; align-items: center;
      padding: 0 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .search-bar { 
      display: flex; align-items: center; justify-content: center; padding: 0 1.2rem; position: relative; 
      .search-icon { position: absolute; left: 2.2rem; color: #666; font-size: 0.9rem; } 
      .clear-icon { position: absolute; right: 2.2rem; color: #888; font-size: 0.9rem; cursor: pointer; transition: 0.2s; &:hover { color: #fff; transform: scale(1.1); } }
      input { width: 100%; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem 2.8rem; border-radius: 1.2rem; color: white; outline: none; transition: 0.3s; font-size: 0.9rem; &:focus { background: rgba(255, 255, 255, 0.08); border-color: rgba(78, 14, 255, 0.4); box-shadow: 0 0 10px rgba(78, 14, 255, 0.1); } } 
  }
  
  .contacts {
    display: flex; flex-direction: column; align-items: center; 
    height: 100%; width: 100%; overflow-y: auto; overflow-x: hidden; 
    gap: 0.8rem; padding: 1.2rem 0.6rem;
    
    &::-webkit-scrollbar { width: 4px; } 
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 10px; }
    
    .empty-state { color: #666; font-style: italic; margin-top: 2rem; font-size: 0.9rem; }
    
    .create-group-btn { width: 92%; background: linear-gradient(90deg, #4e0eff, #9a86f3); padding: 0.9rem; text-align: center; border-radius: 0.8rem; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; gap: 0.6rem; font-weight: bold; font-size: 0.9rem; flex-shrink: 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: 0.3s; &:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(78, 14, 255, 0.3); } }
    
    .skeleton-box { background: rgba(255,255,255,0.02) !important; border: none !important; cursor: default; flex-shrink: 0; &:hover { transform: none; } }
    .skeleton-anim { background: #1a1a2e; background-image: linear-gradient(to right, #1a1a2e 0%, #2a2a3e 20%, #1a1a2e 40%, #1a1a2e 100%); background-repeat: no-repeat; background-size: 800px 100%; animation: ${shimmer} 1.5s infinite linear forwards; }
    .skeleton-line { height: 12px; width: 100px; border-radius: 4px; margin-bottom: 6px; }
    .skeleton-line.short { width: 60px; height: 10px; }

    .search-section-title {
        width: 90%; text-transform: uppercase; color: #888; font-size: 0.75rem; 
        font-weight: 700; margin: 15px 0 5px 0; letter-spacing: 1px; flex-shrink: 0;
    }
    
    .global-msg-item {
        background: rgba(255, 255, 255, 0.03); width: 90%; padding: 0.8rem; 
        border-radius: 0.8rem; cursor: pointer; transition: 0.3s;
        border: 1px solid rgba(78, 14, 255, 0.2); flex-shrink: 0;
        
        &:hover { background: rgba(78, 14, 255, 0.15); border-color: rgba(78, 14, 255, 0.4); transform: translateY(-2px); }
        .msg-text { color: #e0e0e0; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-style: italic;}
        .msg-date { color: #666; font-size: 0.65rem; display: block; margin-top: 6px; text-align: right;}
    }
  }

  .current-user {
      background: rgba(0, 0, 0, 0.3); padding: 1.2rem; display: flex; justify-content: center; align-items: center;
      border-top: 1px solid rgba(255,255,255,0.05); height: 100%; 
      .user-info {
          display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 12px;
          .current-user-avatar { height: 2.8rem; min-width: 2.8rem; width: 2.8rem; border-radius: 50%; overflow: hidden; border: 2px solid rgba(0, 255, 136, 0.2); img { width: 100%; height: 100%; object-fit: cover; } }
          .details { display: flex; flex-direction: column; flex-grow: 1; h2 { color: white; font-size: 1.1rem; font-weight: 600; } .status-text { color: #00ff88; font-size: 0.75rem; font-weight: 500; } }
          .actions { display: flex; gap: 0.6rem; align-items: center; button { border: none; border-radius: 0.6rem; color: white; cursor: pointer; font-size: 0.8rem; font-weight: bold; padding: 0.5rem 0.9rem; display: flex; align-items: center; justify-content: center; transition: 0.3s; } .profile-btn { background: rgba(78, 14, 255, 0.2); color: #9a86f3; &:hover { background: #4e0eff; color: white; } } .logout-btn { background: rgba(255, 78, 78, 0.1); color: #ff4e4e; &:hover { background: #ff4e4e; color: white; } } }
      }
  }
`;

const ContactItem = styled.div`
  background: rgba(255, 255, 255, 0.03); 
  padding: ${({ $isCompact }) => $isCompact ? '0.5rem' : '0.8rem'}; 
  width: 90%; flex-shrink: 0; 
  border-radius: 1rem; display: flex; align-items: center; gap: 1rem; 
  cursor: pointer; border: 1px solid transparent; position: relative;
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden; 

  ${({ $isPinned }) => $isPinned && css`
    background: rgba(255, 255, 255, 0.06); border-left: 3.5px solid #4e0eff;
  `}

  &:hover { 
    background: rgba(255, 255, 255, 0.08); 
    transform: scale(1.03) translateY(-2px); 
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    .pin-btn { opacity: 1; }
  }

  ${({ $selected, $themeType }) => $selected && css`
      background: rgba(78, 14, 255, 0.15); 
      border-color: rgba(78, 14, 255, 0.4);
      transform: scale(1.02);
      ${$themeType === 'cyberpunk' && css`background: rgba(0, 255, 136, 0.1); border-color: #00ff88;`}
  `}

  .avatar { 
    height: 3rem; width: 3rem; min-width: 3rem; border-radius: 50%; overflow: hidden; 
    display: flex; align-items: center; justify-content: center; 
    background: #1a1a2e; transition: box-shadow 0.3s ease;
    img { width: 100%; height: 100%; object-fit: cover; } 
    .group-avatar { font-weight: bold; color: #4e0eff; font-size: 1.3rem; }
    ${({ $selected }) => $selected && css`box-shadow: 0 0 15px rgba(78, 14, 255, 0.5);`}
  }

  .username { 
    flex-grow: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden; 
    h3 { color: #e0e0e0; font-size: 0.95rem; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } 
    .presence-container { display: flex; align-items: center; gap: 5px; }
    .status-text { color: #888; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; } 
    .typing-text { color: #00ff88; font-style: italic; font-weight: 600; letter-spacing: 0.5px; animation: ${glassShine} 2s infinite linear; }
    .online-text { color: #00ff88; font-weight: 500; }
    .offline-text { color: #888; font-style: italic; }
  }
  
  .contact-meta {
    display: flex; flex-direction: column; align-items: flex-end; gap: 8px; min-width: 20px; 
    .online-indicator { height: 8px; width: 8px; background: #00ff88; border-radius: 50%; box-shadow: 0 0 10px #00ff88; }
    .pin-btn {
      background: none; border: none; color: #555; cursor: pointer; transition: 0.2s; font-size: 0.85rem;
      opacity: ${({ $isPinned }) => $isPinned ? 1 : 0};
      &:hover { color: #fff; transform: scale(1.2); }
      &.pinned { color: #4e0eff; }
    }
  }
`;

const FolderBtn = styled.button`
    background: transparent; border: none; color: #777; cursor: pointer;
    font-size: 1.2rem; display: flex; align-items: center; justify-content: center;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
    width: 42px; height: 42px; border-radius: 12px; position: relative;
    
    &:hover { color: #fff; background: rgba(255,255,255,0.08); transform: translateY(-2px); }
    &.active { color: #4e0eff; background: rgba(78, 14, 255, 0.12); box-shadow: 0 4px 10px rgba(78, 14, 255, 0.2); transform: translateY(-2px); }

    .badge {
        position: absolute; top: -2px; right: -2px;
        color: white; font-size: 0.6rem; font-weight: bold;
        padding: 2px 5px; border-radius: 10px; border: 2px solid #131324;
        box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }
    .theme-badge { background: #4e0eff; }
    .danger-badge { background: #ff4e4e; }
`;

const Modal = styled.div`
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; 
    z-index: 100; backdrop-filter: blur(12px);
    .modal-content {
        background: #0d0d30; padding: 2.2rem; border-radius: 1.5rem; width: 440px;
        border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 15px 40px rgba(0,0,0,0.6);
        max-height: 90vh; overflow-y: auto;
        
        &::-webkit-scrollbar { width: 4px; } 
        &::-webkit-scrollbar-track { background: transparent; }
        &::-webkit-scrollbar-thumb { background-color: rgba(78, 14, 255, 0.5); border-radius: 10px; }

        h3 { color: white; margin-bottom: 1.5rem; text-align: center; font-weight: 600; font-size: 1.3rem; }
        .divider { border-color: rgba(255,255,255,0.1); margin: 1.5rem 0; }
        .settings-row { display: flex; gap: 1rem; }
        select, input, textarea { width: 100%; padding: 0.9rem; margin-bottom: 0.8rem; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(78, 14, 255, 0.3); color: white; border-radius: 0.8rem; font-family: inherit; transition: 0.3s; &:focus { outline: none; border-color: #9a86f3; background: rgba(255,255,255,0.08); } }
        .toggle-btn { padding: 0.9rem; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(78, 14, 255, 0.3); border-radius: 0.8rem; cursor: pointer; width: 100%; transition: 0.3s; font-weight: 500;}
        .toggle-btn.active { background: #4e0eff; border-color: #4e0eff; box-shadow: 0 4px 15px rgba(78, 14, 255, 0.3); }
        textarea { resize: none; height: 95px; }
        .input-group { display: flex; flex-direction: column; flex: 1; label { color: #888; font-size: 0.75rem; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05rem; } }
        .member-select { max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem; h4 { color: #888; margin-bottom: 0.6rem; font-size: 0.8rem; text-transform: uppercase; } .select-item { padding: 0.75rem; color: #ddd; cursor: pointer; border-radius: 0.6rem; margin: 4px 0; transition: 0.2s; &:hover { background: rgba(255,255,255,0.06); } &.selected { background: #4e0eff; color: white; font-weight: 600; } } }
        .modal-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; button { padding: 0.8rem 2.4rem; border: none; border-radius: 0.8rem; cursor: pointer; background: #4e0eff; color: white; font-weight: bold; transition: 0.3s; &:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(78, 14, 255, 0.4); } } .cancel { background: #ff4e4e; &:hover { box-shadow: 0 5px 15px rgba(255, 78, 78, 0.4); } } }
    }
`;