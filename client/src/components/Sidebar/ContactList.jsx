import React from "react";
import { motion } from "framer-motion";
import { FaGlobe, FaPlus, FaSpinner, FaThumbtack, FaBellSlash } from "react-icons/fa";
import { ContactItem } from "../Contacts.styles";

export default function ContactList({
    isLoading,
    isCompact,
    activeFolder,
    searchTerm,
    setShowGroupModal,
    setShowDiscoverModal,
    displayedItems,
    onlineUsers,
    pinnedIds,
    globalTypingUsers,
    currentSelected,
    changeCurrentChat,
    setContextMenu,
    getAvatarUrl,
    formatLastSeen,
    togglePin,
    isChatMuted,
    isSearchingGlobal,
    globalMessages,
    handleGlobalMessageClick
}) {
    return (
        <div className="contacts-scroller" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="contact-item skeleton" style={{ display: 'flex', gap: '12px', padding: '12px' }}>
                        <div className="avatar skeleton-anim" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                        {!isCompact && (
                            <div className="details" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                                <div className="skeleton-line skeleton-anim" style={{ height: '12px', width: '60%', borderRadius: '6px' }} />
                                <div className="skeleton-line short skeleton-anim" style={{ height: '12px', width: '40%', borderRadius: '6px' }} />
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <>
                    {!isCompact && activeFolder === "groups" && !searchTerm && (
                        <div className="group-actions" style={{ display: 'flex', gap: '8px', padding: '0 4px 8px' }}>
                            <button className="primary" onClick={() => setShowGroupModal(true)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, var(--msg-sent), #9a41fe)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}><FaPlus /> Create</button>
                            <button className="secondary" onClick={() => setShowDiscoverModal(true)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-main)', fontWeight: 'bold', cursor: 'pointer' }}><FaGlobe /> Discover</button>
                        </div>
                    )}

                    {!isCompact && searchTerm.length >= 3 && <div className="section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: '700', margin: '16px 8px 8px' }}>Chats & Groups</div>}

                    {displayedItems.length === 0 && !searchTerm && !isCompact ? (
                        <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px 0', fontStyle: 'italic' }}>No chats found.</div>
                    ) : (
                        displayedItems.map((item) => {
                            const isOnline = !item.isGroup && onlineUsers?.includes(item._id);
                            const isPinned = pinnedIds?.includes(item._id);
                            const isTyping = !item.isGroup && globalTypingUsers?.includes(item._id);
                            const isSelected = item._id === currentSelected;

                            return (
                                <ContactItem
                                    key={item._id}
                                    className={`${isSelected ? "selected" : ""} ${isPinned ? "pinned" : ""}`}
                                    onClick={() => changeCurrentChat(item, item.isGroup)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, item });
                                    }}
                                    $isCompact={isCompact}
                                    title={isCompact ? item.username : ""}
                                >
                                    <div className="avatar-block" style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                                        {isTyping && <div className="typing-pulse-ring" style={{ position: 'absolute', top: '-4px', left: '-4px', right: '-4px', bottom: '-4px', border: '2px solid var(--msg-sent)', borderRadius: '50%', animation: 'pulseRing 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite' }} />}
                                        
                                        <div className={`avatar-circle ${isOnline ? 'online' : ''}`} style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
                                            {item.isGroup ? 
                                                <div className="group-avatar" style={{ width: '100%', height: '100%', background: 'var(--input-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--msg-sent)', fontSize: '1.2rem', fontWeight: 'bold' }}>#</div> : 
                                                <img src={getAvatarUrl(item)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            }
                                        </div>
                                        {isOnline && <div className="online-badge" style={{ position: 'absolute', bottom: '2px', right: '2px', width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-panel)' }} />}
                                        {isCompact && item.unreadCount > 0 && <span className="compact-badge" style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ff4e4e', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', width: '18px', height: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', border: '2px solid var(--bg-panel)' }}>{item.unreadCount}</span>}
                                    </div>

                                    {!isCompact && (
                                        <>
                                            <div className="details" style={{ flex: 1, overflow: 'hidden' }}>
                                                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.username}</h3>
                                                {item.isGroup ? (
                                                    <p className="status group" style={{ fontSize: '0.8rem', color: 'var(--msg-sent)', margin: 0, fontWeight: '500' }}>Group Chat</p>
                                                ) : (
                                                    <div className="presence" style={{ fontSize: '0.8rem', color: isOnline ? '#10b981' : 'var(--text-dim)' }}>
                                                        {isTyping ? (
                                                            <div className="typing-indicator" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} style={{ width: '4px', height: '4px', background: 'var(--msg-sent)', borderRadius: '50%' }} />
                                                                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} style={{ width: '4px', height: '4px', background: 'var(--msg-sent)', borderRadius: '50%' }} />
                                                                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} style={{ width: '4px', height: '4px', background: 'var(--msg-sent)', borderRadius: '50%' }} />
                                                                <span style={{ color: 'var(--msg-sent)', fontStyle: 'italic', fontWeight: 'bold', marginLeft: '4px' }}>typing</span>
                                                            </div>
                                                        ) : (
                                                            <span>{isOnline ? "Online" : formatLastSeen(item.lastSeen)}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                                <button className="pin-btn" onClick={(e) => togglePin(e, item._id)} style={{ background: 'none', border: 'none', color: isPinned ? 'var(--msg-sent)' : 'var(--text-dim)', cursor: 'pointer', opacity: isPinned ? 1 : 0, transition: '0.2s' }}>
                                                    <FaThumbtack />
                                                </button>
                                                {isChatMuted(item._id) && <FaBellSlash style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }} title="Muted" />}
                                                {item.unreadCount > 0 && !isChatMuted(item._id) && <span className="unread-count" style={{ background: 'var(--msg-sent)', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>{item.unreadCount}</span>}
                                            </div>
                                        </>
                                    )}
                                </ContactItem>
                            );
                        })
                    )}

                    {!isCompact && searchTerm.length >= 3 && (
                        <>
                            <div className="section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: '700', margin: '16px 8px 8px' }}>Message History</div>
                            {isSearchingGlobal ? (
                                <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)' }}><FaSpinner className="fa-spin" /> Searching...</div>
                            ) : globalMessages.length === 0 ? (
                                <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>No matching messages.</div>
                            ) : (
                                globalMessages.map(msg => {
                                    const msgText = msg.message?.text || msg.message;
                                    if (typeof msgText === "string" && msgText.length > 50 && !msgText.includes(" ")) return null;
                                    return (
                                        <div key={msg._id} className="global-msg" onClick={() => handleGlobalMessageClick(msg)} style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--glass-border)', marginBottom: '8px' }}>
                                            <p style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '0 0 4px 0' }}>"{msgText}"</p>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', textAlign: 'right' }}>{new Date(msg.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}