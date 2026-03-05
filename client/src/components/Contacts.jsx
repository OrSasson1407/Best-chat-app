import React, { useState, useEffect, useMemo } from "react";
import styled, { keyframes, css } from "styled-components";
import { FaUserFriends, FaPlus, FaSearch, FaCog, FaThumbtack, FaRegEnvelope } from "react-icons/fa";
import { BsChatDotsFill, BsPeopleFill } from "react-icons/bs";
import { MdOutlineAllInclusive } from "react-icons/md";
import axios from "axios";
import { createGroupRoute, getUserGroupsRoute, updateProfileRoute } from "../utils/APIRoutes";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Safe API constants for Fallback avatar generation
const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

export default function Contacts({ 
  contacts, 
  changeChat, 
  onlineUsers, 
  handleLogout, 
  currentUser,
  theme,
  setTheme,
  isCompact,
  setIsCompact
}) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  
  // Phase 2 State: Folders and Pinning
  const [activeFolder, setActiveFolder] = useState("all"); 
  const [pinnedIds, setPinnedIds] = useState(() => {
    const saved = localStorage.getItem(`pinned-chats-${currentUser?._id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
      statusIcon: "✨", statusMessage: "Available", bio: "", interests: ""
  });

  useEffect(() => {
    const fetchGroups = async () => {
      if(currentUser) {
          try {
              const { data } = await axios.get(`${getUserGroupsRoute}/${currentUser._id}`);
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
          interests: currentUser.interests ? currentUser.interests.join(", ") : ""
      });
      fetchGroups();
    }
  }, [currentUser]);

  // Sync Pinned Chats to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`pinned-chats-${currentUser._id}`, JSON.stringify(pinnedIds));
    }
  }, [pinnedIds, currentUser]);

  const togglePin = (e, id) => {
    e.stopPropagation(); 
    if (pinnedIds.includes(id)) {
      setPinnedIds(pinnedIds.filter(pid => pid !== id));
      toast.info("Chat unpinned");
    } else {
      if (pinnedIds.length >= 5) return toast.warning("Maximum 5 pins allowed");
      setPinnedIds([...pinnedIds, id]);
      toast.success("Chat pinned to top");
    }
  };

  const changeCurrentChat = (contact, isGroup = false) => {
    setCurrentSelected(contact._id);
    changeChat(contact, isGroup); 
  };

  // Phase 2 Logic: Filtering & Sorting Data
  const displayedItems = useMemo(() => {
    let all = [
      ...contacts.map(c => ({ ...c, isGroup: false })),
      ...groups.map(g => ({ ...g, isGroup: true, username: g.name }))
    ];

    // Filter by Search
    if (searchTerm) {
      all = all.filter(item => item.username.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Filter by Folder
    if (activeFolder === "personal") all = all.filter(i => !i.isGroup);
    if (activeFolder === "groups") all = all.filter(i => i.isGroup);
    if (activeFolder === "unread") all = all.filter(i => i.unreadCount > 0); 

    // Sort: Pinned first, then by online status, then alphabetical
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
        const { data } = await axios.post(createGroupRoute, {
            name: groupName, members: [...selectedMembers, currentUser._id], admin: currentUser._id
        });
        if (data.status) {
            setGroups([...groups, data.group]); 
            setShowGroupModal(false); setGroupName(""); setSelectedMembers([]);
            toast.success("Group created successfully!");
        }
    } catch (error) { toast.error("Failed to create group"); }
  };

  const handleUpdateProfile = async () => {
      try {
          const interestsArray = profileData.interests 
            ? profileData.interests.split(",").map(i => i.trim()).filter(i => i !== "") 
            : [];
            
          const { data } = await axios.post(`${updateProfileRoute}/${currentUser._id}`, {
              ...profileData, interests: interestsArray
          });
          
          if(data.status) {
              sessionStorage.setItem("chat-app-user", JSON.stringify(data.user));
              toast.success("Profile and Settings updated!");
              setShowProfileModal(false);
              setTimeout(() => window.location.reload(), 1000); 
          }
      } catch (error) { toast.error("Failed to update profile"); }
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

  return (
    <>
      {currentUserName && (
        <Container $isCompact={isCompact} $themeType={theme}>
          <div className="brand glass-shine-effect">
            <h3>Snappy</h3>
          </div>
          
          {/* Phase 2: Folder System */}
          <div className="folders-bar">
            <FolderBtn 
              className={activeFolder === "all" ? "active" : ""} 
              onClick={() => setActiveFolder("all")} 
              title="All Conversations"
            >
                <MdOutlineAllInclusive />
            </FolderBtn>
            <FolderBtn 
              className={activeFolder === "personal" ? "active" : ""} 
              onClick={() => setActiveFolder("personal")} 
              title="Personal"
            >
                <BsChatDotsFill />
            </FolderBtn>
            <FolderBtn 
              className={activeFolder === "groups" ? "active" : ""} 
              onClick={() => setActiveFolder("groups")} 
              title="Groups"
            >
                <BsPeopleFill />
            </FolderBtn>
            <FolderBtn 
              className={activeFolder === "unread" ? "active" : ""} 
              onClick={() => setActiveFolder("unread")} 
              title="Unread"
            >
                <FaRegEnvelope />
            </FolderBtn>
          </div>

          <div className="search-bar">
             <FaSearch className="search-icon"/>
             <input type="text" placeholder={`Search ${activeFolder}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                {activeFolder === "groups" && (
                    <div className="create-group-btn" onClick={() => setShowGroupModal(true)}><FaPlus /> Create New Group</div>
                )}
                {displayedItems.map((item) => {
                    const isOnline = !item.isGroup && onlineUsers.includes(item._id);
                    const isPinned = pinnedIds.includes(item._id);
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
                                <p className="status-text">{item.statusIcon || "✨"} {item.statusMessage || "Available"}</p>
                            </div>
                            
                            <div className="contact-meta">
                              {isOnline && <div className="online-indicator" />}
                              <button className={`pin-btn ${isPinned ? "pinned" : ""}`} onClick={(e) => togglePin(e, item._id)}>
                                <FaThumbtack />
                              </button>
                            </div>
                        </ContactItem>
                    );
                })}
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

const FolderBtn = styled.button`
    background: transparent; border: none; color: #777; cursor: pointer;
    font-size: 1.2rem; display: flex; align-items: center; justify-content: center;
    transition: 0.3s; width: 42px; height: 42px; border-radius: 12px;
    &:hover { color: #fff; background: rgba(255,255,255,0.08); }
    &.active { color: #4e0eff; background: rgba(78, 14, 255, 0.12); box-shadow: 0 0 10px rgba(78, 14, 255, 0.1); }
`;

const ContactItem = styled.div`
  background: rgba(255, 255, 255, 0.03); 
  padding: ${({ $isCompact }) => $isCompact ? '0.5rem' : '0.8rem'}; 
  width: 92%; 
  border-radius: 1rem;
  display: flex; align-items: center; gap: 1rem; 
  cursor: pointer; border: 1px solid transparent; position: relative;
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.2s ease;

  ${({ $isPinned }) => $isPinned && css`
    background: rgba(255, 255, 255, 0.06);
    border-left: 3.5px solid #4e0eff;
  `}

  &:hover { 
    background: rgba(255, 255, 255, 0.08); 
    transform: scale(1.02) translateY(-2px); 
    .pin-btn { opacity: 1; }
  }

  ${({ $selected, $themeType }) => $selected && css`
      background: rgba(78, 14, 255, 0.15); 
      border-color: rgba(78, 14, 255, 0.4);
      transform: scale(1.02);
      ${$themeType === 'cyberpunk' && css`background: rgba(0, 255, 136, 0.1); border-color: #00ff88;`}
  `}

  .avatar { 
    height: 3rem; width: 3rem; border-radius: 50%; overflow: hidden; 
    display: flex; align-items: center; justify-content: center; 
    background: #1a1a2e; transition: box-shadow 0.3s ease;
    img { width: 100%; height: 100%; object-fit: cover; } 
    .group-avatar { font-weight: bold; color: #4e0eff; font-size: 1.3rem; }
    ${({ $selected }) => $selected && css`box-shadow: 0 0 15px rgba(78, 14, 255, 0.5);`}
  }

  .username { 
    flex-grow: 1; display: flex; flex-direction: column; justify-content: center; 
    h3 { color: #e0e0e0; font-size: 0.95rem; margin-bottom: 2px;} 
    .status-text { color: #888; font-size: 0.75rem; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; } 
  }
  
  .contact-meta {
    display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
    .online-indicator { height: 8px; width: 8px; background: #00ff88; border-radius: 50%; box-shadow: 0 0 10px #00ff88; }
    .pin-btn {
      background: none; border: none; color: #555; cursor: pointer; transition: 0.2s; font-size: 0.85rem;
      opacity: ${({ $isPinned }) => $isPinned ? 1 : 0};
      &:hover { color: #fff; transform: scale(1.2); }
      &.pinned { color: #4e0eff; }
    }
  }
`;

const Modal = styled.div`
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; 
    z-index: 100; backdrop-filter: blur(12px);
    .modal-content {
        background: #0d0d30; padding: 2.2rem; border-radius: 1.5rem; width: 440px;
        border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 15px 40px rgba(0,0,0,0.6);
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

const Container = styled.div`
  display: grid; 
  grid-template-rows: 10% 7.5% 8.5% 59% 15%; 
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
      input { width: 100%; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem 1rem 0.6rem 2.8rem; border-radius: 1.2rem; color: white; outline: none; transition: 0.3s; font-size: 0.9rem; &:focus { background: rgba(255, 255, 255, 0.08); border-color: rgba(78, 14, 255, 0.4); box-shadow: 0 0 10px rgba(78, 14, 255, 0.1); } } 
  }
  
  .contacts {
    display: flex; flex-direction: column; align-items: center; overflow: auto; 
    gap: 0.8rem; padding: 1.2rem 0.6rem;
    &::-webkit-scrollbar { width: 3px; } &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    
    .create-group-btn { width: 92%; background: linear-gradient(90deg, #4e0eff, #9a86f3); padding: 0.9rem; text-align: center; border-radius: 0.8rem; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; gap: 0.6rem; font-weight: bold; font-size: 0.9rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: 0.3s; &:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(78, 14, 255, 0.3); } }
    
    .skeleton-box { background: rgba(255,255,255,0.02) !important; border: none !important; cursor: default; &:hover { transform: none; } }
    .skeleton-anim { background: #1a1a2e; background-image: linear-gradient(to right, #1a1a2e 0%, #2a2a3e 20%, #1a1a2e 40%, #1a1a2e 100%); background-repeat: no-repeat; background-size: 800px 100%; animation: ${shimmer} 1.5s infinite linear forwards; }
    .skeleton-line { height: 12px; width: 100px; border-radius: 4px; margin-bottom: 6px; }
    .skeleton-line.short { width: 60px; height: 10px; }
  }

  .current-user {
      background: rgba(0, 0, 0, 0.3); padding: 1.2rem; display: flex; justify-content: center; align-items: center;
      border-top: 1px solid rgba(255,255,255,0.05);
      .user-info {
          display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 12px;
          .current-user-avatar { height: 2.8rem; min-width: 2.8rem; width: 2.8rem; border-radius: 50%; overflow: hidden; border: 2px solid rgba(0, 255, 136, 0.2); img { width: 100%; height: 100%; object-fit: cover; } }
          .details { display: flex; flex-direction: column; flex-grow: 1; h2 { color: white; font-size: 1.1rem; font-weight: 600; } .status-text { color: #00ff88; font-size: 0.75rem; font-weight: 500; } }
          .actions { display: flex; gap: 0.6rem; align-items: center; button { border: none; border-radius: 0.6rem; color: white; cursor: pointer; font-size: 0.8rem; font-weight: bold; padding: 0.5rem 0.9rem; display: flex; align-items: center; justify-content: center; transition: 0.3s; } .profile-btn { background: rgba(78, 14, 255, 0.2); color: #9a86f3; &:hover { background: #4e0eff; color: white; } } .logout-btn { background: rgba(255, 78, 78, 0.1); color: #ff4e4e; &:hover { background: #ff4e4e; color: white; } } }
      }
  }
`;