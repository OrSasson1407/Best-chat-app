import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    FaUserPlus, FaShieldAlt, FaInfoCircle, FaSearch, 
    FaUserSlash, FaMicrophoneAlt, FaMagic, FaGlobe, FaSpinner 
} from "react-icons/fa";
import { formatLastSeen } from "./chatHelpers";
import { ChatHeader as StyledHeader } from "./ChatContainer.styles";
import useChatStore from "../store/chatStore";

export default function ChatHeader({
    currentChat, currentUser, isBlocked, isOnline, lastSeen,
    showSearch, searchQuery, setSearchQuery, setShowSearch,
    showSidePanel, setShowSidePanel, setActiveSideTab,
    handleToggleBlock, handleAddMember, setIncomingCallData, setShowCallModal,
    handleSummarize, isSummarizing, setShowGlobalSearchModal 
}) {
    const theme = useChatStore((state) => state.theme);
    return (
        <StyledHeader $themeType={theme}>
            <div className="user-details">
                <div className="header-info" onClick={() => { setShowSidePanel(true); setActiveSideTab('about'); }} style={{ cursor: 'pointer' }}>
                    <h3>
                        {currentChat.name || currentChat.username} 
                        {isBlocked && <span style={{ color: '#ef4444', fontSize: '10px', marginLeft: '6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>(Blocked)</span>}
                    </h3>
                    
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
                    {/* --- FEATURE 2: AI Summarize Button --- */}
                    <button 
                        className="huddle-btn" 
                        onClick={handleSummarize} 
                        disabled={isSummarizing} 
                        style={{ background: 'var(--msg-sent)', color: 'white' }}
                    >
                        {isSummarizing ? <FaSpinner className="fa-spin" style={{ marginRight: '5px' }} /> : <FaMagic style={{ marginRight: '5px' }} />} 
                        {isSummarizing ? "Thinking..." : "Summarize"}
                    </button>

                    {/* --- FEATURE 1: Global Search Trigger --- */}
                    <FaGlobe 
                        className="action-icon" 
                        title="Global Chat Search" 
                        onClick={() => setShowGlobalSearchModal(true)} 
                    />

                    {/* --- ANIMATED LOCAL SEARCH BAR --- */}
                    <AnimatePresence>
                        {showSearch && (
                            <motion.input 
                                initial={{ width: 0, opacity: 0, padding: "0" }}
                                animate={{ width: "200px", opacity: 1, padding: "0.5rem 1rem" }}
                                exit={{ width: 0, opacity: 0, padding: "0" }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                type="text" 
                                placeholder="Search this chat..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                                className="chat-search-input" 
                                autoFocus
                            />
                        )}
                    </AnimatePresence>
                    
                    <FaSearch 
                        className="action-icon" 
                        title="Search local messages" 
                        onClick={() => setShowSearch(!showSearch)} 
                    />
                    
                    <FaInfoCircle 
                        className="action-icon" 
                        title="Contact Info & Media" 
                        onClick={() => { setShowSidePanel(!showSidePanel); setActiveSideTab('about'); }} 
                    />

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
                        <FaUserSlash 
                            className={`action-icon ${isBlocked ? 'blocked' : ''}`} 
                            title={isBlocked ? "Unblock User" : "Block User"} 
                            onClick={handleToggleBlock} 
                        />
                    )}
                    
                    {currentChat.admin === currentUser._id && (
                        <>
                            <span className="admin-badge"><FaShieldAlt /> Admin</span>
                            <FaUserPlus className="action-icon" onClick={handleAddMember} title="Add Member" />
                        </>
                    )}
                </div>
            </div>
        </StyledHeader>
    );
}