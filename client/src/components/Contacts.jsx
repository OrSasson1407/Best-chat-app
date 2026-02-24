import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { FaUserFriends, FaPlus, FaSearch } from "react-icons/fa";
import { BsChatDotsFill } from "react-icons/bs";
import axios from "axios";
import { createGroupRoute, getUserGroupsRoute } from "../utils/APIRoutes";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Contacts({ contacts, changeChat, onlineUsers, handleLogout, currentUser }) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  const [view, setView] = useState("contacts"); 
  const [groups, setGroups] = useState([]);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal State for Creating Groups
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    // Moved fetchGroups inside useEffect to fix exhaustive-deps warning
    const fetchGroups = async () => {
      if(currentUser) {
          try {
              const { data } = await axios.get(`${getUserGroupsRoute}/${currentUser._id}`);
              setGroups(data);
          } catch (error) {
              console.error("Error fetching groups:", error);
          }
      }
    };

    if (currentUser) {
      setCurrentUserName(currentUser.username);
      fetchGroups();
    }
  }, [currentUser]);

  const changeCurrentChat = (index, contact, isGroup = false) => {
    setCurrentSelected(index);
    changeChat(contact, isGroup); 
  };

  const handleCreateGroup = async () => {
    if (groupName.length < 3) {
        return toast.error("Group name must be > 3 characters", { position: "bottom-right", theme: "dark" });
    }
    if (selectedMembers.length < 1) {
        return toast.error("Select at least 1 member", { position: "bottom-right", theme: "dark" });
    }

    try {
        const { data } = await axios.post(createGroupRoute, {
            name: groupName,
            members: [...selectedMembers, currentUser._id], // Add self to group
            admin: currentUser._id
        });

        if (data.status) {
            setGroups([...groups, data.group]); // Update local list
            setShowModal(false); // Close modal
            setGroupName("");
            setSelectedMembers([]);
            toast.success("Group created successfully!", { position: "bottom-right", theme: "dark" });
        }
    } catch (error) {
        toast.error("Failed to create group", { position: "bottom-right", theme: "dark" });
    }
  };

  const toggleMemberSelection = (id) => {
    if (selectedMembers.includes(id)) {
        setSelectedMembers(selectedMembers.filter(m => m !== id));
    } else {
        setSelectedMembers([...selectedMembers, id]);
    }
  };

  // Filter Logic based on Search Term
  const filteredContacts = contacts.filter(c => c.username.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
      {currentUserName && (
        <Container>
          <div className="brand">
            <h3>Snappy</h3>
          </div>
          
          <div className="tabs">
            <button className={view === "contacts" ? "active" : ""} onClick={() => {setView("contacts"); setSearchTerm("");}}>
                <BsChatDotsFill /> Contacts
            </button>
            <button className={view === "groups" ? "active" : ""} onClick={() => {setView("groups"); setSearchTerm("");}}>
                <FaUserFriends /> Groups
            </button>
          </div>

          <div className="search-bar">
             <FaSearch className="search-icon"/>
             <input 
                type="text" 
                placeholder={`Search ${view}...`} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>

          <div className="contacts">
            {view === "contacts" ? (
                filteredContacts.map((contact, index) => {
                    const isOnline = onlineUsers.includes(contact._id);
                    return (
                        <div key={contact._id} className={`contact ${index === currentSelected ? "selected" : ""}`} onClick={() => changeCurrentChat(index, contact, false)}>
                            <div className="avatar">
                                {contact.username[0].toUpperCase()}
                            </div>
                            <div className="username">
                                <h3>{contact.username}</h3>
                                {isOnline && <div className="online-indicator" />}
                            </div>
                        </div>
                    );
                })
            ) : (
                <>
                    <div className="create-group-btn" onClick={() => setShowModal(true)}>
                        <FaPlus /> Create New Group
                    </div>
                    {filteredGroups.map((group, index) => (
                        <div key={group._id} className={`contact ${index === currentSelected ? "selected" : ""}`} onClick={() => changeCurrentChat(index, group, true)}>
                            <div className="avatar group-avatar">#</div>
                            <div className="username">
                                <h3>{group.name}</h3>
                            </div>
                        </div>
                    ))}
                </>
            )}
          </div>

          <div className="current-user">
             <div className="user-info">
                 <h2>{currentUserName}</h2>
                 <button onClick={handleLogout}>Logout</button>
             </div>
          </div>

          {showModal && (
              <Modal>
                  <div className="modal-content">
                      <h3>Create Group</h3>
                      <input type="text" placeholder="Group Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                      <div className="member-select">
                          <h4>Select Members:</h4>
                          {contacts.map(contact => (
                              <div key={contact._id} className={`select-item ${selectedMembers.includes(contact._id) ? "selected" : ""}`} onClick={() => toggleMemberSelection(contact._id)}>
                                  {contact.username}
                              </div>
                          ))}
                      </div>
                      <div className="modal-actions">
                          <button onClick={handleCreateGroup}>Create</button>
                          <button className="cancel" onClick={() => setShowModal(false)}>Cancel</button>
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
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.8);
    display: flex; justify-content: center; align-items: center;
    z-index: 100;
    backdrop-filter: blur(5px);

    .modal-content {
        background: #0d0d30;
        padding: 2rem;
        border-radius: 1rem;
        width: 400px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 0 20px rgba(0,0,0,0.5);

        h3 { color: white; margin-bottom: 1rem; text-align: center; }
        
        input {
            width: 100%; padding: 0.8rem; margin-bottom: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid #4e0eff;
            color: white; border-radius: 0.5rem;
            &:focus { outline: none; border-color: #9a86f3; }
        }

        .member-select { 
            max-height: 200px; overflow-y: auto; margin-bottom: 1rem;
            h4 { color: #ccc; margin-bottom: 0.5rem; font-size: 0.9rem; }
            
            .select-item { 
                padding: 0.5rem; color: white; cursor: pointer; 
                border-radius: 0.3rem; margin: 2px 0; transition: 0.2s;
                &:hover { background: #ffffff10; }
            }
            .selected { background-color: #9a86f3; color: white; font-weight: bold; }
        }

        .modal-actions {
            display: flex; gap: 1rem; justify-content: center;
            button { 
                padding: 0.6rem 2rem; border: none; border-radius: 0.5rem; 
                cursor: pointer; background: #4e0eff; color: white; font-weight: bold;
                transition: 0.3s;
                &:hover { opacity: 0.9; }
            }
            .cancel { background: #ff4e4e; }
        }
    }
`;

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 8% 7% 60% 15%; 
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.05);

  .search-bar {
      display: flex; align-items: center; justify-content: center;
      padding: 0 1rem;
      position: relative;
      
      .search-icon {
          position: absolute; left: 1.5rem; color: #ccc; font-size: 0.9rem;
      }
      
      input {
          width: 100%; background: rgba(255, 255, 255, 0.05); border: none;
          padding: 0.5rem 1rem 0.5rem 2.5rem; border-radius: 1rem; color: white;
          outline: none; transition: 0.3s;
          &:focus { background: rgba(255, 255, 255, 0.1); box-shadow: 0 0 5px #4e0eff; }
      }
  }

  .brand {
    display: flex; align-items: center; justify-content: center;
    h3 { color: #fff; text-transform: uppercase; letter-spacing: 0.2rem; }
  }

  .tabs {
      display: flex; justify-content: space-around; align-items: center;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      
      button {
          background: transparent; border: none;
          color: #fff; font-size: 1rem; cursor: pointer;
          display: flex; align-items: center; gap: 0.5rem;
          opacity: 0.5; transition: 0.3s;
          padding: 0.5rem 1rem;
          &:hover { opacity: 1; }
      }
      .active { 
          opacity: 1; color: #9a86f3; 
          border-bottom: 2px solid #9a86f3;
      }
  }

  .contacts {
    display: flex; flex-direction: column; align-items: center; 
    overflow: auto; gap: 0.8rem; padding: 1rem 0.5rem;
    
    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; }

    .create-group-btn {
        width: 90%; background: linear-gradient(90deg, #4e0eff, #9a86f3);
        padding: 0.8rem; text-align: center; border-radius: 0.5rem;
        cursor: pointer; color: white; display: flex; align-items: center; justify-content: center;
        gap: 0.5rem; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        transition: 0.3s;
        &:hover { transform: translateY(-2px); }
    }

    .contact {
      background: rgba(255, 255, 255, 0.03);
      padding: 0.8rem; width: 90%; border-radius: 1rem;
      display: flex; align-items: center; gap: 1rem;
      transition: 0.3s ease; cursor: pointer;
      border: 1px solid transparent;

      &:hover { background: rgba(255, 255, 255, 0.08); transform: scale(1.02); }

      .avatar {
        height: 3rem; width: 3rem; background: #4e0eff; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; color: white; font-size: 1.2rem;
      }
      .group-avatar { background: #ff0055; font-size: 1.5rem; }

      .username {
        display: flex; align-items: center; gap: 0.5rem;
        h3 { color: #e0e0e0; font-size: 0.9rem; }
      }

      .online-indicator {
        height: 8px; width: 8px; background: #00ff88;
        border-radius: 50%; box-shadow: 0 0 10px #00ff88;
      }
    }

    .selected {
      background: rgba(78, 14, 255, 0.2);
      border: 1px solid rgba(78, 14, 255, 0.4);
    }
  }

  .current-user {
      background: rgba(0, 0, 0, 0.3);
      padding: 1rem;
      display: flex; justify-content: center; align-items: center;
      
      .user-info {
          display: flex; justify-content: space-between; align-items: center; width: 100%;
          h2 { color: white; font-size: 1rem; }
          button {
              background: #ff4e4e; border: none; padding: 0.4rem 0.8rem;
              border-radius: 0.5rem; color: white; cursor: pointer;
              font-size: 0.7rem; font-weight: bold;
              &:hover { background: #d32f2f; }
          }
      }
  }
`;