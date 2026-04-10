import React from "react";
import { FaGlobe, FaPlus, FaSpinner } from "react-icons/fa";
import ContactItem from "./ContactItem";
import { ContactItemWrapper } from "./ContactList.styles";

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
                    <ContactItemWrapper key={i} className="skeleton">
                        <div className="avatar skeleton-anim" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                        {!isCompact && (
                            <div className="details" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                                <div className="skeleton-line skeleton-anim" style={{ height: '12px', width: '60%', borderRadius: '6px' }} />
                                <div className="skeleton-line short skeleton-anim" style={{ height: '12px', width: '40%', borderRadius: '6px' }} />
                            </div>
                        )}
                    </ContactItemWrapper>
                ))
            ) : (
                <>
                    {/* Groups Contextual Actions */}
                    {!isCompact && activeFolder === "groups" && !searchTerm && (
                        <div className="group-actions" style={{ display: 'flex', gap: '8px', padding: '0 4px 8px' }}>
                            <button className="primary" onClick={() => setShowGroupModal(true)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, var(--msg-sent), #9a41fe)', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <FaPlus /> Create
                            </button>
                            <button className="secondary" onClick={() => setShowDiscoverModal(true)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-main)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <FaGlobe /> Discover
                            </button>
                        </div>
                    )}

                    {/* Section Title when Searching */}
                    {!isCompact && searchTerm.length >= 3 && (
                        <div className="section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: '700', margin: '16px 8px 8px' }}>
                            Chats & Groups
                        </div>
                    )}

                    {/* Contact List Iteration */}
                    {displayedItems.length === 0 && !searchTerm && !isCompact ? (
                        <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px 0', fontStyle: 'italic' }}>
                            No chats found.
                        </div>
                    ) : (
                        displayedItems.map((item) => (
                            <ContactItem
                                key={item._id}
                                item={item}
                                isCompact={isCompact}
                                currentSelected={currentSelected}
                                changeCurrentChat={changeCurrentChat}
                                setContextMenu={setContextMenu}
                                getAvatarUrl={getAvatarUrl}
                                formatLastSeen={formatLastSeen}
                                onlineUsers={onlineUsers}
                                pinnedIds={pinnedIds}
                                globalTypingUsers={globalTypingUsers}
                                isChatMuted={isChatMuted}
                                togglePin={togglePin}
                            />
                        ))
                    )}

                    {/* Global Message Search Results */}
                    {!isCompact && searchTerm.length >= 3 && (
                        <>
                            <div className="section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: '700', margin: '16px 8px 8px' }}>
                                Message History
                            </div>
                            
                            {isSearchingGlobal ? (
                                <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                                    <FaSpinner className="fa-spin" /> Searching...
                                </div>
                            ) : globalMessages.length === 0 ? (
                                <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                    No matching messages.
                                </div>
                            ) : (
                                globalMessages.map(msg => {
                                    const msgText = msg.message?.text || msg.message;
                                    if (typeof msgText === "string" && msgText.length > 50 && !msgText.includes(" ")) return null;
                                    
                                    return (
                                        <div key={msg._id} className="global-msg" onClick={() => handleGlobalMessageClick(msg)} style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--glass-border)', marginBottom: '8px' }}>
                                            <p style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '0 0 4px 0' }}>
                                                "{msgText}"
                                            </p>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', textAlign: 'right' }}>
                                                {new Date(msg.createdAt).toLocaleDateString()}
                                            </span>
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