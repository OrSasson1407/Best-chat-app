import React from "react";
import { motion } from "framer-motion";
import { FaThumbtack, FaBellSlash } from "react-icons/fa";
import { ContactItemWrapper } from "./ContactList.styles";

export default function ContactItem({
    item,
    isCompact,
    currentSelected,
    changeCurrentChat,
    setContextMenu,
    getAvatarUrl,
    formatLastSeen,
    onlineUsers,
    pinnedIds,
    globalTypingUsers,
    isChatMuted,
    togglePin
}) {
    const isOnline = !item.isGroup && onlineUsers?.includes(item._id);
    const isPinned = pinnedIds?.includes(item._id);
    const isTyping = !item.isGroup && globalTypingUsers?.includes(item._id);
    const isSelected = item._id === currentSelected;

    return (
        <ContactItemWrapper
            as={motion.div}
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.97 }}
            className={`${isSelected ? "selected" : ""} ${isPinned ? "pinned" : ""}`}
            onClick={() => changeCurrentChat(item, item.isGroup)}
            onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, item });
            }}
            title={isCompact ? item.username : ""}
        >
            <div className="avatar-block" style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                {isTyping && (
                    <div className="typing-pulse-ring" style={{ position: 'absolute', top: '-4px', left: '-4px', right: '-4px', bottom: '-4px', border: '2px solid var(--msg-sent)', borderRadius: '50%', animation: 'pulseRing 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite' }} />
                )}

                <div className={`avatar-circle ${isOnline ? 'online' : ''}`} style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
                    {item.isGroup ?
                        <div className="group-avatar" style={{ width: '100%', height: '100%', background: 'var(--input-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--msg-sent)', fontSize: '1.2rem', fontWeight: 'bold' }}>#</div> :
                        <img src={getAvatarUrl(item)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    }
                </div>
                
                {isOnline && <div className="online-badge" style={{ position: 'absolute', bottom: '2px', right: '2px', width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-panel)' }} />}
                
                {isCompact && item.unreadCount > 0 && (
                    <span className="compact-badge" style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ff4e4e', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', width: '18px', height: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', border: '2px solid var(--bg-panel)' }}>
                        {item.unreadCount}
                    </span>
                )}
            </div>

            {!isCompact && (
                <>
                    <div className="details" style={{ flex: 1, overflow: 'hidden' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.username || item.name}
                        </h3>
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
                        {item.unreadCount > 0 && !isChatMuted(item._id) && (
                            <span className="unread-count" style={{ background: 'var(--msg-sent)', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                                {item.unreadCount}
                            </span>
                        )}
                    </div>
                </>
            )}
        </ContactItemWrapper>
    );
}