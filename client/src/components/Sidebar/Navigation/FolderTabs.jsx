import React from "react";
import { MdOutlineAllInclusive } from "react-icons/md";
import { BsChatDotsFill, BsPeopleFill } from "react-icons/bs";
import { FaRegEnvelope, FaArchive } from "react-icons/fa";

export default function FolderTabs({ 
    isCompact, 
    activeFolder, 
    setActiveFolder,
    totalUnreadChatsCount = 0,
    unreadPersonalChatsCount = 0,
    unreadGroupsCount = 0,
    archivedCount = 0
}) {
    const folders = [
        { id: "all", icon: <MdOutlineAllInclusive />, title: "All", badge: totalUnreadChatsCount },
        { id: "personal", icon: <BsChatDotsFill size={14} />, title: "Personal", badge: unreadPersonalChatsCount },
        { id: "groups", icon: <BsPeopleFill />, title: "Groups", badge: unreadGroupsCount },
        { id: "unread", icon: <FaRegEnvelope size={14} />, title: "Unread", badge: totalUnreadChatsCount, danger: true },
        { id: "archived", icon: <FaArchive size={13} />, title: "Archive", badge: archivedCount },
    ];

    return (
        <div className="nav-folders" style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: '4px', padding: isCompact ? '0 10px' : '0 16px', flexShrink: 0, marginBottom: '16px' }}>
            {folders.map(f => (
                <button 
                    key={f.id} 
                    className={`folder-item ${activeFolder === f.id ? 'active' : ''}`}
                    onClick={() => setActiveFolder(f.id)}
                    title={isCompact ? f.title : ""}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: isCompact ? 'center' : 'center',
                        gap: '6px', padding: isCompact ? '12px 0' : '8px 0', background: activeFolder === f.id ? 'var(--input-bg)' : 'transparent',
                        border: '1px solid', borderColor: activeFolder === f.id ? 'var(--glass-border)' : 'transparent',
                        borderRadius: '12px', color: activeFolder === f.id ? 'var(--text-main)' : 'var(--text-dim)',
                        cursor: 'pointer', position: 'relative'
                    }}
                >
                    <div className="icon-wrap" style={{ position: 'relative', fontSize: '1.2rem', display: 'flex' }}>
                        {f.icon}
                        {f.badge > 0 && (
                            <span className="folder-badge" style={{ position: 'absolute', top: '-6px', right: '-8px', background: f.danger ? '#ff4e4e' : 'var(--msg-sent)', color: 'white', fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 5px', borderRadius: '10px', border: '2px solid var(--bg-panel)' }}>
                                {f.badge}
                            </span>
                        )}
                    </div>
                    {!isCompact && <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{f.title}</span>}
                </button>
            ))}
        </div>
    );
}