import React, { useState, useMemo } from "react";
import { 
    FaTimes, FaSpinner, FaLink, FaFileDownload, FaAngleDown, FaCrown, 
    FaShieldAlt, FaSignOutAlt, FaTrashAlt, FaExclamationTriangle, 
    FaBell, FaBellSlash, FaSearch, FaPalette, FaInfoCircle, FaImage
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { SideInfoPanel } from "./ChatContainer.styles";
import { getSmallAvatar, formatLastSeen } from "./chatHelpers";
import useChatStore from "../store/chatStore";
import axios from "axios";
import { toast } from "react-toastify";

import { 
    promoteToModeratorRoute, 
    demoteModeratorRoute, 
    promoteToAdminRoute, 
    kickMemberRoute 
} from "../utils/APIRoutes";

export default function ChatSidePanel({
    theme, currentChat, isOnline, lastSeen, activeSideTab,
    setActiveSideTab, setShowSidePanel, isFetchingMedia, chatMedia, setLightboxImage,
    handleWallpaperChange
}) {
    const { currentUser, setCurrentChat } = useChatStore();
    const [actionMenuOpen, setActionMenuOpen] = useState(null);
    const [loadingAction, setLoadingAction] = useState(false);
    
    // Feature States
    const [showAllMembers, setShowAllMembers] = useState(false);
    const [isMuted, setIsMuted] = useState(false); 
    const [mediaSearch, setMediaSearch] = useState("");

    const isGroup = currentChat?.admins !== undefined;
    const myRoleIsAdmin = isGroup && currentChat.admins?.includes(currentUser._id);
    const myRoleIsMod = isGroup && currentChat.moderators?.includes(currentUser._id);

    // Optimistic UI Updates
    const handleMemberAction = async (action, targetUserId) => {
        setLoadingAction(true);
        setActionMenuOpen(null); 

        const previousChat = { ...currentChat };
        let optimisticChat = { ...currentChat };

        try {
            const config = {}; // ✅ FIX: App.js interceptor handles Authorization header automatically
            let res;

            if (action === 'promote_admin') {
                optimisticChat.admins = [...(optimisticChat.admins || []), targetUserId];
                setCurrentChat(optimisticChat);
                res = await axios.post(promoteToAdminRoute, { groupId: currentChat._id, targetUserId }, config);
            } else if (action === 'promote_mod') {
                optimisticChat.moderators = [...(optimisticChat.moderators || []), targetUserId];
                setCurrentChat(optimisticChat);
                res = await axios.post(promoteToModeratorRoute, { groupId: currentChat._id, targetUserId }, config);
            } else if (action === 'demote_mod') {
                optimisticChat.moderators = optimisticChat.moderators.filter(id => id !== targetUserId);
                setCurrentChat(optimisticChat);
                res = await axios.post(demoteModeratorRoute, { groupId: currentChat._id, targetUserId }, config);
            } else if (action === 'kick') {
                optimisticChat.members = optimisticChat.members.filter(m => (m._id || m) !== targetUserId);
                optimisticChat.admins = optimisticChat.admins?.filter(id => id !== targetUserId);
                optimisticChat.moderators = optimisticChat.moderators?.filter(id => id !== targetUserId);
                setCurrentChat(optimisticChat);
                res = await axios.post(kickMemberRoute, { groupId: currentChat._id, userId: targetUserId }, config);
            }

            if (res.data.status) {
                toast.success("Member updated.");
            } else {
                setCurrentChat(previousChat); 
                console.error("[API] Member action failed on server.");
                toast.error("Failed to update member.");
            }
        } catch (error) {
            setCurrentChat(previousChat); 
            console.error("[API] Error applying member action:", error);
            toast.error(error.response?.data?.msg || "Action failed. Please try again.");
        } finally {
            setLoadingAction(false);
        }
    };

    const filteredLinks = useMemo(() => {
        return chatMedia.links?.filter(m => (m.linkMetadata?.title || m.message).toLowerCase().includes(mediaSearch.toLowerCase())) || [];
    }, [chatMedia.links, mediaSearch]);

    const filteredFiles = useMemo(() => {
        return chatMedia.files?.filter(m => (m.fileMetadata?.fileName || "").toLowerCase().includes(mediaSearch.toLowerCase())) || [];
    }, [chatMedia.files, mediaSearch]);

    const displayedMembers = showAllMembers ? currentChat.members : currentChat.members?.slice(0, 5);

    // --- UX IMPROVEMENT: Smoother structural animation for tab switching ---
    const tabVariants = {
        hidden: { opacity: 0, scale: 0.98 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, scale: 0.98, transition: { duration: 0.1 } }
    };

    return (
        <SideInfoPanel $themeType={theme}>
            <div className="panel-header">
                <div className="header-title-set" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaInfoCircle className="header-icon" style={{ color: 'var(--msg-sent)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                        {activeSideTab === 'about' ? (isGroup ? 'Group Info' : 'Contact Info') : 'Shared Content'}
                    </h3>
                </div>
                <button className="close-panel-btn" onClick={() => setShowSidePanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>
                    <FaTimes />
                </button>
            </div>
            
            <div className="tabs-navigation" style={{ display: 'flex', gap: '8px', padding: '0 20px 15px', borderBottom: '1px solid var(--glass-border)' }}>
                {[
                    { id: 'about', label: 'Info', icon: <FaInfoCircle /> },
                    { id: 'media', label: 'Media', icon: <FaImage /> },
                    { id: 'links', label: 'Links', icon: <FaLink /> },
                    { id: 'files', label: 'Files', icon: <FaFileDownload /> }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        className={activeSideTab === tab.id ? 'active' : ''} 
                        onClick={() => setActiveSideTab(tab.id)}
                        style={{ 
                            flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                            background: activeSideTab === tab.id ? 'var(--input-bg)' : 'transparent',
                            border: '1px solid', borderColor: activeSideTab === tab.id ? 'var(--glass-border)' : 'transparent',
                            borderRadius: '8px', color: activeSideTab === tab.id ? 'var(--text-main)' : 'var(--text-dim)',
                            cursor: 'pointer', transition: '0.2s', fontSize: '0.75rem'
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="panel-content" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeSideTab}
                        variants={tabVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="tab-content-wrapper"
                    >
                        {activeSideTab === 'about' ? (
                            <div className="about-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* --- HERO PROFILE --- */}
                                <div className="profile-hero-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                    <div className="avatar-wrapper" style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '15px' }}>
                                        <img 
                                            src={currentChat.avatarImage ? `https://avatar.iran.liara.run/public/${currentChat.avatarImage}` : getSmallAvatar(currentChat.name || currentChat.username)} 
                                            alt="hero" 
                                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--glass-border)' }}
                                        />
                                        {!isGroup && isOnline && (
                                            <div className="active-glow-ring" style={{ position: 'absolute', bottom: '5px', right: '5px', width: '18px', height: '18px', background: '#10b981', borderRadius: '50%', border: '3px solid var(--bg-panel)', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }} />
                                        )}
                                    </div>
                                    <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '5px' }}>{currentChat.name || currentChat.username}</h3>
                                    <p className="presence-tag" style={{ 
                                        color: isGroup ? (currentChat.isPublic ? '#34B7F1' : '#10b981') : (isOnline ? '#10b981' : 'var(--text-dim)'), 
                                        background: isGroup ? (currentChat.isPublic ? 'rgba(52,183,241,0.1)' : 'rgba(16, 185, 129, 0.1)') : (isOnline ? 'rgba(16, 185, 129, 0.1)' : 'transparent'),
                                        padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', display: 'inline-block'
                                    }}>
                                        {isGroup ? (currentChat.isPublic ? "Public Channel" : "Private Group") : (isOnline ? "Online Now" : formatLastSeen(lastSeen))}
                                    </p>
                                </div>

                                {/* --- SMART INFO GRID --- */}
                                <div className="info-grid" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    
                                    <div className="info-item" style={{ background: 'var(--input-bg)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 'bold' }}>
                                            About
                                        </label>
                                        <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                            {currentChat.description || currentChat.bio || "No description provided."}
                                        </p>
                                        
                                        {/* If personal, show interests inline if they exist */}
                                        {!isGroup && currentChat.interests?.length > 0 && (
                                            <div className="interests-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                                                {currentChat.interests.map((i, idx) => (
                                                    <span key={idx} style={{ background: 'var(--bg-panel)', color: 'var(--text-main)', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>{i}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {isGroup && (
                                        <div className="info-item" style={{ background: 'var(--input-bg)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', fontWeight: 'bold' }}>
                                                <span>Members ({currentChat.members?.length || 0})</span>
                                                {loadingAction && <FaSpinner className="fa-spin" style={{ color: 'var(--msg-sent)' }} />}
                                            </label>
                                            
                                            <div className="members-stack" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {displayedMembers?.map((member) => {
                                                    const memberId = member._id || member;
                                                    const memberName = member.username || `User`;
                                                    const isUserAdmin = currentChat.admins?.includes(memberId);
                                                    const isUserMod = currentChat.moderators?.includes(memberId);
                                                    
                                                    // Action logic variables
                                                    const isMe = memberId === currentUser._id;
                                                    const canKick = (myRoleIsAdmin && !isMe) || (myRoleIsMod && !isUserAdmin && !isUserMod && !isMe);
                                                    const canPromoteToMod = myRoleIsAdmin && !isUserAdmin && !isUserMod && !isMe;
                                                    const canPromoteToAdmin = myRoleIsAdmin && !isUserAdmin && !isMe;
                                                    const canDemoteMod = myRoleIsAdmin && isUserMod && !isUserAdmin && !isMe;
                                                    const hasActions = canKick || canPromoteToMod || canPromoteToAdmin || canDemoteMod;

                                                    return (
                                                        <div key={memberId} className="member-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <img src={getSmallAvatar(memberName)} alt="av" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span className="m-name" style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '500' }}>
                                                                    {memberName} {isMe && <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>(You)</span>}
                                                                </span>
                                                                {isUserAdmin && <FaCrown className="role-icon admin" title="Admin" style={{ color: '#10b981', fontSize: '0.8rem' }} />}
                                                                {isUserMod && !isUserAdmin && <FaShieldAlt className="role-icon mod" title="Moderator" style={{ color: '#34B7F1', fontSize: '0.8rem' }} />}
                                                            </div>
                                                            
                                                            {/* Nested dropdown action logic (kept from original) */}
                                                            {hasActions && (
                                                                <div style={{ position: 'relative' }}>
                                                                    <button 
                                                                        onClick={() => setActionMenuOpen(actionMenuOpen === memberId ? null : memberId)}
                                                                        disabled={loadingAction}
                                                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                                                                    >
                                                                        <FaAngleDown />
                                                                    </button>
                                                                    
                                                                    {actionMenuOpen === memberId && (
                                                                        <div className="action-dropdown" style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg-panel)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '4px', zIndex: 10, width: '140px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                                                            {canPromoteToAdmin && <button style={{width:'100%', padding:'8px', background:'transparent', border:'none', color:'var(--text-main)', textAlign:'left', cursor:'pointer', fontSize:'0.8rem'}} onClick={() => handleMemberAction('promote_admin', memberId)}>Make Admin</button>}
                                                                            {canPromoteToMod && <button style={{width:'100%', padding:'8px', background:'transparent', border:'none', color:'var(--text-main)', textAlign:'left', cursor:'pointer', fontSize:'0.8rem'}} onClick={() => handleMemberAction('promote_mod', memberId)}>Make Moderator</button>}
                                                                            {canDemoteMod && <button style={{width:'100%', padding:'8px', background:'transparent', border:'none', color:'#f59e0b', textAlign:'left', cursor:'pointer', fontSize:'0.8rem'}} onClick={() => handleMemberAction('demote_mod', memberId)}>Remove Mod</button>}
                                                                            {canKick && <button style={{width:'100%', padding:'8px', background:'transparent', border:'none', color:'#ef4444', textAlign:'left', cursor:'pointer', fontSize:'0.8rem'}} onClick={() => handleMemberAction('kick', memberId)}>Kick Member</button>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {currentChat.members?.length > 5 && (
                                                    <button className="expand-list-btn" onClick={() => setShowAllMembers(!showAllMembers)} style={{ background: 'transparent', border: 'none', color: 'var(--msg-sent)', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', marginTop: '5px', textAlign: 'left' }}>
                                                        {showAllMembers ? "Show Less" : `View All ${currentChat.members?.length} Members`}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="info-item" style={{ background: 'var(--input-bg)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', fontWeight: 'bold' }}>
                                            <FaPalette style={{ marginRight: '5px' }}/> Appearance
                                        </label>
                                        <div className="wallpaper-selector" style={{ display: 'flex', gap: '10px' }}>
                                            {['#050510', 'linear-gradient(135deg, #1f005c, #5b0060)', 'linear-gradient(135deg, #004d40, #000000)'].map((bg, i) => (
                                                <div key={i} className="bg-option" style={{ width: '40px', height: '40px', borderRadius: '8px', background: bg, cursor: 'pointer', border: '2px solid var(--glass-border)' }} onClick={() => handleWallpaperChange(bg)} />
                                            ))}
                                            <button style={{ height: '40px', padding: '0 12px', borderRadius: '8px', background: 'var(--bg-panel)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', cursor: 'pointer', fontSize:'0.8rem' }} onClick={() => handleWallpaperChange('transparent')}>Clear</button>
                                        </div>
                                    </div>
                                </div>

                                {/* --- QUICK ACTIONS --- */}
                                <div className="action-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                                    <button className="action-row" onClick={() => setIsMuted(!isMuted)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--input-bg)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.95rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {isMuted ? <FaBellSlash style={{ color: '#ef4444' }} /> : <FaBell style={{ color: 'var(--msg-sent)' }} />}
                                            <span style={{ fontWeight: '500' }}>Mute Notifications</span>
                                        </div>
                                        <div className={`smart-toggle ${isMuted ? 'on' : ''}`} style={{ width: '40px', height: '24px', background: isMuted ? '#ef4444' : 'var(--glass-border)', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                            <div style={{ position: 'absolute', top: '2px', left: isMuted ? '18px' : '2px', width: '20px', height: '20px', background: '#fff', borderRadius: '50%', transition: '0.3s' }} />
                                        </div>
                                    </button>

                                    {isGroup && (
                                        <button className="action-row danger" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                            <FaSignOutAlt />
                                            <span>Leave Group</span>
                                        </button>
                                    )}
                                    
                                    <button className="action-row danger" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                        <FaTrashAlt />
                                        <span>Clear Conversation</span>
                                    </button>

                                    <button className="action-row danger" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--input-bg)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)', color: '#ef4444', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                                        <FaExclamationTriangle />
                                        <span>Report Chat</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* --- MEDIA, LINKS, FILES RENDERING --- */
                            <div className="shared-content-section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="search-bar-mini" style={{ position: 'relative', marginBottom: '20px' }}>
                                    <FaSearch style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
                                    <input 
                                        placeholder={`Search ${activeSideTab}...`} 
                                        value={mediaSearch} 
                                        onChange={e => setMediaSearch(e.target.value)} 
                                        style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', outline: 'none' }}
                                    />
                                </div>

                                {isFetchingMedia ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}><FaSpinner className="fa-spin" size={24} /></div>
                                ) : (
                                    <>
                                        {activeSideTab === 'media' && (
                                            chatMedia.media.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '20px' }}>No media shared yet.</p> :
                                            <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                                {chatMedia.media.map(m => (
                                                    <div key={m.id} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: 'var(--input-bg)' }}>
                                                        {m.type === 'image' ? 
                                                            <img src={m.message} alt="shared" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => setLightboxImage(m.message)} /> :
                                                            <video src={m.message} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        }
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {activeSideTab === 'links' && (
                                            filteredLinks.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '20px' }}>No matching links found.</p> :
                                            <div className="links-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {filteredLinks.map(m => (
                                                    <a key={m.id} href={m.linkMetadata?.url || m.message} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: '12px', padding: '12px', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', textDecoration: 'none' }}>
                                                        <div style={{ width: '40px', height: '40px', background: 'rgba(52,183,241,0.1)', color: '#34B7F1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaLink /></div>
                                                        <div style={{ overflow: 'hidden' }}>
                                                            <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.linkMetadata?.title || m.message}</h4>
                                                            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.linkMetadata?.url || m.message}</p>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        )}

                                        {activeSideTab === 'files' && (
                                            filteredFiles.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '20px' }}>No matching files found.</p> :
                                            <div className="links-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {filteredFiles.map(m => (
                                                    <a key={m.id} href={m.message} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: '12px', padding: '12px', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', textDecoration: 'none' }}>
                                                        <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaFileDownload /></div>
                                                        <div style={{ overflow: 'hidden' }}>
                                                            <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.fileMetadata?.fileName || "Attachment"}</h4>
                                                            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: 0 }}>{m.fileMetadata?.fileSize || "Unknown Size"}</p>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </SideInfoPanel>
    );
}