import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { FaUserFriends, FaPlus, FaSearch, FaUserEdit } from "react-icons/fa";
import { BsChatDotsFill } from "react-icons/bs";
import axios from "axios";
import { createGroupRoute, getUserGroupsRoute, updateProfileRoute } from "../utils/APIRoutes";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Safe API constants for Fallback avatar generation on old accounts
const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

export default function Contacts({ contacts, changeChat, onlineUsers, handleLogout, currentUser }) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  const [view, setView] = useState("contacts"); 
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
      statusIcon: "💬", statusMessage: "Available", bio: "", interests: ""
  });

  useEffect(() => {
    const fetchGroups = async () => {
      if(currentUser) {
          try {
              const { data } = await axios.get(`${getUserGroupsRoute}/${currentUser._id}`);
              setGroups(data);
          } catch (error) { console.error("Error fetching groups:", error); }
      }
    };

    if (currentUser) {
      setCurrentUserName(currentUser.username);
      setProfileData({
          statusIcon: currentUser.statusIcon || "💬",
          statusMessage: currentUser.statusMessage || "Available",
          bio: currentUser.bio || "",
          interests: currentUser.interests ? currentUser.interests.join(", ") : ""
      });
      fetchGroups();
    }
  }, [currentUser]);

  const changeCurrentChat = (index, contact, isGroup = false) => {
    setCurrentSelected(index);
    changeChat(contact, isGroup); 
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
          // Fixed: Prevent saving an array with an empty string if interests are blank
          const interestsArray = profileData.interests 
            ? profileData.interests.split(",").map(i => i.trim()).filter(i => i !== "") 
            : [];
            
          const { data } = await axios.post(`${updateProfileRoute}/${currentUser._id}`, {
              ...profileData, interests: interestsArray
          });
          
          if(data.status) {
              sessionStorage.setItem("chat-app-user", JSON.stringify(data.user));
              toast.success("Profile updated!");
              setShowProfileModal(false);
              setTimeout(() => window.location.reload(), 1000); 
          }
      } catch (error) { toast.error("Failed to update profile"); }
  };

  const toggleMemberSelection = (id) => {
    if (selectedMembers.includes(id)) setSelectedMembers(selectedMembers.filter(m => m !== id));
    else setSelectedMembers([...selectedMembers, id]);
  };

  const filteredContacts = contacts.filter(c => c.username.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // FIX: Safely handles Liara strings, Base64 strings, Full URLs, AND generates DiceBear fallbacks.
  const getAvatarUrl = (user) => {
      if (user?.avatarImage) {
          // If the avatar is the broken Liara format, fix it by attaching the domain
          if (!user.avatarImage.startsWith("http") && !user.avatarImage.startsWith("data:")) {
              return `https://avatar.iran.liara.run/public/${user.avatarImage}`;
          }
          // Otherwise it's a valid Base64 or URL, return it
          return user.avatarImage; 
      }
      
      // Fallback API URL for old users without an avatarImage
      const seed = user?.username || 'default';
      const isFemale = user?.gender === 'female';
      const tops = isFemale ? femaleTops : maleTops;
      
      return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&top=${tops}&backgroundColor=${backgroundColors}`;
  };

  return (
    <>
      {currentUserName && (
        <Container>
          <div className="brand"><h3>Snappy</h3></div>
          
          <div className="tabs">
            <button className={view === "contacts" ? "active" : ""} onClick={() => {setView("contacts"); setSearchTerm("");}}><BsChatDotsFill /> Contacts</button>
            <button className={view === "groups" ? "active" : ""} onClick={() => {setView("groups"); setSearchTerm("");}}><FaUserFriends /> Groups</button>
          </div>

          <div className="search-bar">
             <FaSearch className="search-icon"/>
             <input type="text" placeholder={`Search ${view}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="contacts">
            {view === "contacts" ? (
                filteredContacts.map((contact, index) => {
                    const isOnline = onlineUsers.includes(contact._id);
                    return (
                        <div key={contact._id} className={`contact ${index === currentSelected ? "selected" : ""}`} onClick={() => changeCurrentChat(index, contact, false)}>
                            
                            <div className="avatar">
                                <img src={getAvatarUrl(contact)} alt="avatar" />
                            </div>

                            <div className="username">
                                <h3>{contact.username}</h3>
                                <p className="status-text">{contact.statusIcon || "💬"} {contact.statusMessage || "Available"}</p>
                            </div>
                            {isOnline && <div className="online-indicator" />}
                        </div>
                    );
                })
            ) : (
                <>
                    <div className="create-group-btn" onClick={() => setShowGroupModal(true)}><FaPlus /> Create New Group</div>
                    {filteredGroups.map((group, index) => (
                        <div key={group._id} className={`contact ${index === currentSelected ? "selected" : ""}`} onClick={() => changeCurrentChat(index, group, true)}>
                            <div className="avatar group-avatar">#</div>
                            <div className="username"><h3>{group.name}</h3></div>
                        </div>
                    ))}
                </>
            )}
          </div>

          <div className="current-user">
             <div className="user-info">
                 
                 <div className="current-user-avatar">
                     <img src={getAvatarUrl(currentUser)} alt="avatar" />
                 </div>

                 <div className="details">
                     <h2>{currentUserName}</h2>
                     <p className="status-text">{currentUser?.statusIcon || "💬"} {currentUser?.statusMessage || "Available"}</p>
                 </div>
                 
                 <div className="actions">
                     <button className="profile-btn" onClick={() => setShowProfileModal(true)} title="Edit Profile"><FaUserEdit size={16}/></button>
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

          {/* Profile Editing Modal */}
          {showProfileModal && (
              <Modal>
                  <div className="modal-content profile-modal">
                      <h3>Edit Profile & Status</h3>
                      <div className="input-group">
                          <label>Status Icon (Emoji)</label>
                          <input type="text" maxLength="2" value={profileData.statusIcon} onChange={(e) => setProfileData({...profileData, statusIcon: e.target.value})} />
                      </div>
                      <div className="input-group">
                          <label>Status Message</label>
                          <input type="text" placeholder="At the Gym, In a Meeting..." maxLength="50" value={profileData.statusMessage} onChange={(e) => setProfileData({...profileData, statusMessage: e.target.value})} />
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

          <ToastContainer />
        </Container>
      )}
    </>
  );
}

const Modal = styled.div`
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; 
    z-index: 100; backdrop-filter: blur(5px);
    .modal-content {
        background: #0d0d30; padding: 2rem; border-radius: 1rem; width: 400px;
        border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 0 20px rgba(0,0,0,0.5);
        h3 { color: white; margin-bottom: 1.5rem; text-align: center; }
        input, textarea { width: 100%; padding: 0.8rem; margin-bottom: 1rem; background: rgba(255, 255, 255, 0.05); border: 1px solid #4e0eff; color: white; border-radius: 0.5rem; font-family: inherit; &:focus { outline: none; border-color: #9a86f3; } }
        textarea { resize: none; height: 80px; }
        .input-group { display: flex; flex-direction: column; label { color: #aaa; font-size: 0.8rem; margin-bottom: 0.3rem; } }
        .member-select { max-height: 200px; overflow-y: auto; margin-bottom: 1rem; h4 { color: #ccc; margin-bottom: 0.5rem; font-size: 0.9rem; } .select-item { padding: 0.5rem; color: white; cursor: pointer; border-radius: 0.3rem; margin: 2px 0; transition: 0.2s; &:hover { background: #ffffff10; } } .selected { background-color: #9a86f3; color: white; font-weight: bold; } }
        .modal-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; button { padding: 0.6rem 2rem; border: none; border-radius: 0.5rem; cursor: pointer; background: #4e0eff; color: white; font-weight: bold; transition: 0.3s; &:hover { opacity: 0.9; } } .cancel { background: #ff4e4e; } }
    }
`;

const Container = styled.div`
  display: grid; grid-template-rows: 10% 8% 7% 60% 15%; overflow: hidden;
  background: rgba(0, 0, 0, 0.2); border-right: 1px solid rgba(255, 255, 255, 0.05);
  .search-bar { display: flex; align-items: center; justify-content: center; padding: 0 1rem; position: relative; .search-icon { position: absolute; left: 1.5rem; color: #ccc; font-size: 0.9rem; } input { width: 100%; background: rgba(255, 255, 255, 0.05); border: none; padding: 0.5rem 1rem 0.5rem 2.5rem; border-radius: 1rem; color: white; outline: none; transition: 0.3s; &:focus { background: rgba(255, 255, 255, 0.1); box-shadow: 0 0 5px #4e0eff; } } }
  .brand { display: flex; align-items: center; justify-content: center; h3 { color: #fff; text-transform: uppercase; letter-spacing: 0.2rem; } }
  .tabs { display: flex; justify-content: space-around; align-items: center; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); button { background: transparent; border: none; color: #fff; font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; opacity: 0.5; transition: 0.3s; padding: 0.5rem 1rem; &:hover { opacity: 1; } } .active { opacity: 1; color: #9a86f3; border-bottom: 2px solid #9a86f3; } }
  
  .contacts {
    display: flex; flex-direction: column; align-items: center; overflow: auto; gap: 0.8rem; padding: 1rem 0.5rem;
    &::-webkit-scrollbar { width: 3px; } &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    .create-group-btn { width: 90%; background: linear-gradient(90deg, #4e0eff, #9a86f3); padding: 0.8rem; text-align: center; border-radius: 0.5rem; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: 0.3s; &:hover { transform: translateY(-2px); } }
    
    .contact {
      background: rgba(255, 255, 255, 0.03); padding: 0.8rem; width: 90%; border-radius: 1rem;
      display: flex; align-items: center; gap: 1rem; transition: 0.3s ease; cursor: pointer; border: 1px solid transparent; position: relative;
      &:hover { background: rgba(255, 255, 255, 0.08); transform: scale(1.02); }

      .avatar { height: 3rem; width: 3rem; background: #4e0eff; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; background: #1a1a2e; img { width: 100%; height: 100%; object-fit: cover; } }
      .group-avatar { background: #ff0055; font-size: 1.5rem; overflow: visible;}

      .username { display: flex; flex-direction: column; justify-content: center; h3 { color: #e0e0e0; font-size: 0.95rem; margin-bottom: 2px;} .status-text { color: #aaa; font-size: 0.75rem; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; } }
      .online-indicator { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); height: 10px; width: 10px; background: #00ff88; border-radius: 50%; box-shadow: 0 0 10px #00ff88; }
    }
    .selected { background: rgba(78, 14, 255, 0.2); border: 1px solid rgba(78, 14, 255, 0.4); }
  }

  .current-user {
      background: rgba(0, 0, 0, 0.3); padding: 1rem; display: flex; justify-content: center; align-items: center;
      .user-info {
          display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;
          .current-user-avatar { height: 2.5rem; min-width: 2.5rem; width: 2.5rem; border-radius: 50%; overflow: hidden; background: #1a1a2e; img { width: 100%; height: 100%; object-fit: cover; } }
          .details { display: flex; flex-direction: column; flex-grow: 1; h2 { color: white; font-size: 1.1rem; } .status-text { color: #00ff88; font-size: 0.75rem; } }
          .actions { display: flex; gap: 0.5rem; align-items: center; button { border: none; border-radius: 0.5rem; color: white; cursor: pointer; font-size: 0.8rem; font-weight: bold; padding: 0.4rem 0.8rem; display: flex; align-items: center; justify-content: center; transition: 0.2s; } .profile-btn { background: #4e0eff; &:hover { background: #6c38ff; } } .logout-btn { background: #ff4e4e; &:hover { background: #d32f2f; } } }
      }
  }
`;