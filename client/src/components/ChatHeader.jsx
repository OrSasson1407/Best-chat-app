import React from "react";
import { FaUserPlus, FaShieldAlt, FaInfoCircle, FaSearch, FaUserSlash, FaMicrophoneAlt } from "react-icons/fa";
import { formatLastSeen } from "./chatHelpers";

export default function ChatHeader({
    currentChat, currentUser, isBlocked, isOnline, lastSeen,
    showSearch, searchQuery, setSearchQuery, setShowSearch,
    showSidePanel, setShowSidePanel, setActiveSideTab,
    handleToggleBlock, handleAddMember, setIncomingCallData, setShowCallModal
}) {
    return (
        <div className="chat-header">
            <div className="user-details">
                <div className="header-info" onClick={() => { setShowSidePanel(true); setActiveSideTab('about'); }} style={{ cursor: 'pointer' }}>
                    <h3>{currentChat.name || currentChat.username} {isBlocked && <span style={{ color: 'red', fontSize: '10px' }}>(Blocked)</span>}</h3>
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
    );
}