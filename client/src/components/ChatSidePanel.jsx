import React, { useState, useMemo } from "react";
import { 
    FaTimes, FaSpinner, FaLink, FaFileDownload, FaAngleDown, FaCrown, 
    FaShieldAlt, FaSignOutAlt, FaTrashAlt, FaExclamationTriangle, 
    FaBell, FaBellSlash, FaSearch, FaPalette
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
            const config = { headers: { "x-auth-token": currentUser.token } };
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
                toast.success("Action applied successfully.");
            } else {
                setCurrentChat(previousChat); 
                toast.error("Action failed to apply on server.");
            }
        } catch (error) {
            setCurrentChat(previousChat); 
            toast.error(error.response?.data?.msg || "Network error. Action reverted.");
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

    const tabVariants = {
        hidden: { opacity: 0, x: 30 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
        exit: { opacity: 0, x: -30, transition: { duration: 0.2, ease: "easeIn" } }
    };

    return (
        <SideInfoPanel $themeType={theme}>
            <div className="panel-header">
                <h3>{activeSideTab === 'about' ? (isGroup ? 'Group Details' : 'Contact Details') : 'Shared Content'}</h3>
                <button onClick={() => setShowSidePanel(false)}><FaTimes /></button>
            </div>
            
            <div className="tabs">
                <button className={activeSideTab === 'about' ? 'active' : ''} onClick={() => setActiveSideTab('about')}>About</button>
                <button className={activeSideTab === 'media' ? 'active' : ''} onClick={() => setActiveSideTab('media')}>Media</button>
                <button className={activeSideTab === 'links' ? 'active' : ''} onClick={() => setActiveSideTab('links')}>Links</button>
                <button className={activeSideTab === 'files' ? 'active' : ''} onClick={() => setActiveSideTab('files')}>Files</button>
            </div>

            <div className="panel-content">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeSideTab}
                        variants={tabVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    >
                        {activeSideTab === 'about' ? (
                            <div className="about-section">
                                {isGroup ? (
                                    <>
                                        <div className="profile-hero">
                                            <img src={currentChat.avatarImage ? `https://avatar.iran.liara.run/public/${currentChat.avatarImage}` : getSmallAvatar(currentChat.name)} alt="hero" />
                                            <h3>{currentChat.name}</h3>
                                            <p className="presence" style={{ color: currentChat.isPublic ? '#34B7F1' : '#00ff88', background: currentChat.isPublic ? 'rgba(52,183,241,0.1)' : 'rgba(0,255,136,0.1)' }}>
                                                {currentChat.isPublic ? "Public Channel" : "Private Group"}
                                            </p>
                                        </div>

                                        <div className="info-card">
                                            <label>Description</label>
                                            <p>{currentChat.description || "No description available."}</p>
                                        </div>

                                        <div className="info-card">
                                            <label><FaPalette /> Chat Wallpaper</label>
                                            <div className="wallpaper-presets">
                                                <button className="color-swatch" style={{background: '#050510'}} onClick={() => handleWallpaperChange('#050510')}></button>
                                                <button className="color-swatch" style={{background: 'linear-gradient(135deg, #1f005c, #5b0060, #870160)'}} onClick={() => handleWallpaperChange('linear-gradient(135deg, #1f005c, #5b0060, #870160)')}></button>
                                                <button className="color-swatch" style={{background: 'linear-gradient(135deg, #004d40, #000000)'}} onClick={() => handleWallpaperChange('linear-gradient(135deg, #004d40, #000000)')}></button>
                                                <button className="clear-wallpaper" onClick={() => handleWallpaperChange('transparent')}>Clear</button>
                                            </div>
                                        </div>

                                        <div className="info-card" style={{ padding: '1rem' }}>
                                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Members ({currentChat.members?.length || 0})</span>
                                                {loadingAction && <FaSpinner className="fa-spin" style={{ color: 'var(--msg-sent)' }} />}
                                            </label>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '10px' }}>
                                                {displayedMembers?.map((member) => {
                                                    const memberId = member._id || member;
                                                    const memberName = member.username || `User (${memberId.substring(0, 4)})`;
                                                    const memberAvatar = member.avatarImage ? `https://avatar.iran.liara.run/public/${member.avatarImage}` : getSmallAvatar(memberName);

                                                    const isUserAdmin = currentChat.admins?.includes(memberId);
                                                    const isUserMod = currentChat.moderators?.includes(memberId);
                                                    const isMe = memberId === currentUser._id;

                                                    const canKick = (myRoleIsAdmin && !isMe) || (myRoleIsMod && !isUserAdmin && !isUserMod && !isMe);
                                                    const canPromoteToMod = myRoleIsAdmin && !isUserAdmin && !isUserMod && !isMe;
                                                    const canPromoteToAdmin = myRoleIsAdmin && !isUserAdmin && !isMe;
                                                    const canDemoteMod = myRoleIsAdmin && isUserMod && !isUserAdmin && !isMe;
                                                    const hasActions = canKick || canPromoteToMod || canPromoteToAdmin || canDemoteMod;

                                                    return (
                                                        <div key={memberId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--glass-border)', position: 'relative' }}>
                                                            <img src={memberAvatar} alt="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-panel)' }} />
                                                            
                                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
                                                                    {memberName} {isMe && <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.8rem', fontWeight: 'normal' }}> (You)</span>}
                                                                </span>
                                                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                                                    {isUserAdmin && (
                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold', border: '1px solid rgba(0, 255, 136, 0.3)' }}>
                                                                            <FaCrown /> Admin
                                                                        </span>
                                                                    )}
                                                                    {isUserMod && !isUserAdmin && (
                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', background: 'rgba(52, 183, 241, 0.1)', color: '#34B7F1', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold', border: '1px solid rgba(52, 183, 241, 0.3)' }}>
                                                                            <FaShieldAlt /> Mod
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {hasActions && (
                                                                <div>
                                                                    <button 
                                                                        onClick={() => setActionMenuOpen(actionMenuOpen === memberId ? null : memberId)}
                                                                        disabled={loadingAction}
                                                                        style={{ background: 'var(--input-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', transition: '0.2s' }}
                                                                    >
                                                                        <FaAngleDown />
                                                                    </button>
                                                                    
                                                                    {actionMenuOpen === memberId && (
                                                                        <div className="action-dropdown">
                                                                            {canPromoteToAdmin && (
                                                                                <button onClick={() => handleMemberAction('promote_admin', memberId)}>Make Admin</button>
                                                                            )}
                                                                            {canPromoteToMod && (
                                                                                <button onClick={() => handleMemberAction('promote_mod', memberId)}>Make Moderator</button>
                                                                            )}
                                                                            {canDemoteMod && (
                                                                                <button className="warning" onClick={() => handleMemberAction('demote_mod', memberId)}>Remove Mod</button>
                                                                            )}
                                                                            {canKick && (
                                                                                <button className="danger" onClick={() => handleMemberAction('kick', memberId)}>Kick Member</button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {currentChat.members?.length > 5 && !showAllMembers && (
                                                    <button className="view-all-btn" onClick={() => setShowAllMembers(true)}>View All ({currentChat.members.length})</button>
                                                )}
                                                {showAllMembers && (
                                                    <button className="view-all-btn" onClick={() => setShowAllMembers(false)}>Show Less</button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="profile-hero">
                                            <img src={currentChat.avatarImage ? `https://avatar.iran.liara.run/public/${currentChat.avatarImage}` : getSmallAvatar(currentChat.username)} alt="hero" />
                                            <h3>{currentChat.username}</h3>
                                            <p className="presence">{isOnline ? "Online Now" : formatLastSeen(lastSeen)}</p>
                                        </div>

                                        <div className="info-card">
                                            <label>Bio</label>
                                            <p>{currentChat.bio || "No bio available."}</p>
                                        </div>

                                        <div className="info-card">
                                            <label>Interests</label>
                                            <div className="interests-grid">
                                                {currentChat.interests?.length > 0 ? currentChat.interests.map((i, idx) => <span key={idx} className="interest-tag">{i}</span>) : <span>No interests listed.</span>}
                                            </div>
                                        </div>

                                        <div className="info-card">
                                            <label>Groups in Common</label>
                                            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No mutual groups found.</p>
                                        </div>
                                    </>
                                )}

                                <div className="info-card toggle-card" onClick={() => setIsMuted(!isMuted)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {isMuted ? <FaBellSlash color="#ff4e4e" /> : <FaBell color="var(--msg-sent)" />}
                                        <span style={{ fontWeight: '600' }}>Mute Notifications</span>
                                    </div>
                                    <div className={`toggle-switch ${isMuted ? 'on' : 'off'}`}></div>
                                </div>

                                <div className="danger-zone">
                                    {isGroup && <button className="danger-btn"><FaSignOutAlt /> Leave Group</button>}
                                    <button className="danger-btn"><FaTrashAlt /> Clear History</button>
                                    <button className="danger-btn"><FaExclamationTriangle /> Report Chat</button>
                                </div>
                            </div>
                        ) : (
                            isFetchingMedia ? <div className="loader"><FaSpinner className="fa-spin" /></div> : (
                                <>
                                    {(activeSideTab === 'links' || activeSideTab === 'files') && (
                                        <div className="tab-search">
                                            <FaSearch className="icon"/>
                                            <input 
                                                type="text" 
                                                placeholder={`Search ${activeSideTab}...`} 
                                                value={mediaSearch} 
                                                onChange={e => setMediaSearch(e.target.value)} 
                                            />
                                        </div>
                                    )}

                                    {activeSideTab === 'media' ? (
                                        chatMedia.media.length === 0 ? <p className="empty-state">No media shared yet.</p> :
                                            <div className="media-grid">
                                                {chatMedia.media.map(m => (
                                                    m.type === 'image' ? <img key={m.id} src={m.message} alt="shared" onClick={() => setLightboxImage(m.message)} /> :
                                                        <video key={m.id} src={m.message} controls />
                                                ))}
                                            </div>
                                    ) : activeSideTab === 'links' ? (
                                        filteredLinks.length === 0 ? <p className="empty-state">No matching links found.</p> :
                                            <div className="links-list">
                                                {filteredLinks.map(m => (
                                                    <a key={m.id} href={m.linkMetadata?.url || m.message} target="_blank" rel="noreferrer" className="link-item">
                                                        <div className="link-icon"><FaLink /></div>
                                                        <div className="link-info">
                                                            <h4>{m.linkMetadata?.title || m.message}</h4>
                                                            <p>{m.linkMetadata?.url || m.message}</p>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                    ) : (
                                        filteredFiles.length === 0 ? <p className="empty-state">No matching files found.</p> :
                                            <div className="links-list">
                                                {filteredFiles.map(m => (
                                                    <a key={m.id} href={m.message} target="_blank" rel="noreferrer" className="link-item">
                                                        <div className="link-icon"><FaFileDownload /></div>
                                                        <div className="link-info">
                                                            <h4>{m.fileMetadata?.fileName || "Attachment"}</h4>
                                                            <p>{m.fileMetadata?.fileSize || "Unknown Size"}</p>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                    )}
                                </>
                            )
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </SideInfoPanel>
    );
}