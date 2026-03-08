import React from "react";
import { FaTimes, FaSpinner, FaLink, FaFileDownload } from "react-icons/fa";
import { SideInfoPanel } from "./ChatContainer.styles";
import { getSmallAvatar, formatLastSeen } from "./chatHelpers";

export default function ChatSidePanel({
    theme, currentChat, isOnline, lastSeen, activeSideTab,
    setActiveSideTab, setShowSidePanel, isFetchingMedia, chatMedia, setLightboxImage
}) {
    return (
        <SideInfoPanel $themeType={theme}>
            <div className="panel-header">
                <h3>{activeSideTab === 'about' ? 'Contact Details' : 'Shared Content'}</h3>
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