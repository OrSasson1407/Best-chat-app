import React, { useState } from "react";
import { FaTimes, FaSpinner, FaLink, FaFileDownload, FaAngleDown, FaCrown, FaShieldAlt } from "react-icons/fa";
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
    setActiveSideTab, setShowSidePanel, isFetchingMedia, chatMedia, setLightboxImage
}) {
    const { currentUser } = useChatStore();
    const [actionMenuOpen, setActionMenuOpen] = useState(null);
    const [loadingAction, setLoadingAction] = useState(false);

    // Identify if the current chat is a Group or Channel (has admins array)
    const isGroup = currentChat?.admins !== undefined;

    // Permissions for the current user
    const myRoleIsAdmin = isGroup && currentChat.admins?.includes(currentUser._id);
    const myRoleIsMod = isGroup && currentChat.moderators?.includes(currentUser._id);

    const handleMemberAction = async (action, targetUserId) => {
        setLoadingAction(true);
        setActionMenuOpen(null); // Close menu
        try {
            const config = { headers: { "x-auth-token": currentUser.token } };
            let res;

            if (action === 'promote_admin') {
                res = await axios.post(promoteToAdminRoute, { groupId: currentChat._id, targetUserId }, config);
            } else if (action === 'promote_mod') {
                res = await axios.post(promoteToModeratorRoute, { groupId: currentChat._id, targetUserId }, config);
            } else if (action === 'demote_mod') {
                res = await axios.post(demoteModeratorRoute, { groupId: currentChat._id, targetUserId }, config);
            } else if (action === 'kick') {
                res = await axios.post(kickMemberRoute, { groupId: currentChat._id, userId: targetUserId }, config);
            }

            if (res.data.status) {
                toast.success("Action successful! Reload to see changes.");
                // In a full production app, you would dispatch a Redux/Zustand action here 
                // to instantly update the `currentChat.members` array in the UI.
            }
        } catch (error) {
            toast.error(error.response?.data?.msg || "Action failed.");
        } finally {
            setLoadingAction(false);
        }
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
                {activeSideTab === 'about' ? (
                    <div className="about-section">
                        {isGroup ? (
                            <>
                                {/* GROUP PROFILE HERO */}
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

                                {/* MEMBERS LIST WITH ADMIN CONTROLS */}
                                <div className="info-card" style={{ padding: '1rem' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Members ({currentChat.members?.length || 0})</span>
                                        {loadingAction && <FaSpinner className="fa-spin" style={{ color: 'var(--msg-sent)' }} />}
                                    </label>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '10px' }}>
                                        {currentChat.members?.map((member) => {
                                            // Handle populated objects vs raw IDs
                                            const memberId = member._id || member;
                                            const memberName = member.username || `User (${memberId.substring(0, 4)})`;
                                            const memberAvatar = member.avatarImage ? `https://avatar.iran.liara.run/public/${member.avatarImage}` : getSmallAvatar(memberName);

                                            const isUserAdmin = currentChat.admins?.includes(memberId);
                                            const isUserMod = currentChat.moderators?.includes(memberId);
                                            const isMe = memberId === currentUser._id;

                                            // Permission Logic
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

                                                    {/* ACTION DROPDOWN FOR ADMINS/MODS */}
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
                                                                <div style={{ position: 'absolute', right: 0, top: '40px', background: 'var(--bg-panel)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '4px 0', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', width: '160px', overflow: 'hidden' }}>
                                                                    {canPromoteToAdmin && (
                                                                        <button onClick={() => handleMemberAction('promote_admin', memberId)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.background='var(--input-bg)'} onMouseOut={e => e.target.style.background='none'}>
                                                                            Make Admin
                                                                        </button>
                                                                    )}
                                                                    {canPromoteToMod && (
                                                                        <button onClick={() => handleMemberAction('promote_mod', memberId)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.background='var(--input-bg)'} onMouseOut={e => e.target.style.background='none'}>
                                                                            Make Moderator
                                                                        </button>
                                                                    )}
                                                                    {canDemoteMod && (
                                                                        <button onClick={() => handleMemberAction('demote_mod', memberId)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ffcc00', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.background='var(--input-bg)'} onMouseOut={e => e.target.style.background='none'}>
                                                                            Remove Mod
                                                                        </button>
                                                                    )}
                                                                    {canKick && (
                                                                        <button onClick={() => handleMemberAction('kick', memberId)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ff4e4e', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.background='rgba(255, 78, 78, 0.1)'} onMouseOut={e => e.target.style.background='none'}>
                                                                            Kick Member
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* 1-ON-1 PROFILE HERO */
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
                            </>
                        )}
                    </div>
                ) : (
                    isFetchingMedia ? <div className="loader"><FaSpinner className="fa-spin" /></div> : (
                        activeSideTab === 'media' ? (
                            chatMedia.media.length === 0 ? <p className="empty-state">No media shared yet.</p> :
                                <div className="media-grid">
                                    {chatMedia.media.map(m => (
                                        m.type === 'image' ? <img key={m.id} src={m.message} alt="shared" onClick={() => setLightboxImage(m.message)} /> :
                                            <video key={m.id} src={m.message} controls />
                                    ))}
                                </div>
                        ) : activeSideTab === 'links' ? (
                            chatMedia.links.length === 0 ? <p className="empty-state">No links shared yet.</p> :
                                <div className="links-list">
                                    {chatMedia.links.map(m => (
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
                            chatMedia.files?.length === 0 ? <p className="empty-state">No files shared yet.</p> :
                                <div className="links-list">
                                    {chatMedia.files?.map(m => (
                                        <a key={m.id} href={m.message} target="_blank" rel="noreferrer" className="link-item">
                                            <div className="link-icon"><FaFileDownload /></div>
                                            <div className="link-info">
                                                <h4>{m.fileMetadata?.fileName || "Attachment"}</h4>
                                                <p>{m.fileMetadata?.fileSize || "Unknown Size"}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                        )
                    )
                )}
            </div>
        </SideInfoPanel>
    );
}