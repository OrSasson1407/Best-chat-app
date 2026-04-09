import React from "react";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";

export default function SidebarFooter({
    isCompact,
    currentUser,
    currentUserName,
    theme,
    setTheme,
    handleLogout,
    setShowProfileModal,
    getAvatarUrl
}) {
    return (
        <div className="sidebar-footer" style={{ padding: isCompact ? "16px 8px" : "16px", borderTop: "1px solid var(--glass-border)", background: "var(--bg-panel)", flexShrink: 0 }}>
            <div className="user-profile" style={{ display: 'flex', flexDirection: isCompact ? "column" : "row", alignItems: 'center', gap: isCompact ? "16px" : "12px" }}>
                <div className="avatar" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid var(--msg-sent)', cursor: 'pointer' }} onClick={() => setShowProfileModal(true)}>
                    <img src={getAvatarUrl(currentUser)} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                </div>

                {!isCompact && (
                    <div className="info" style={{ flex: 1, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setShowProfileModal(true)}>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUserName}</h2>
                        <p style={{ fontSize: '0.75rem', color: 'var(--adaptive-accent)', margin: 0, fontWeight: '500' }}>{currentUser?.statusIcon || "✨"} {currentUser?.statusMessage || "Available"}</p>
                    </div>
                )}
                <div className="actions" style={{ display: 'flex', gap: '4px', flexDirection: isCompact ? "column" : "row" }}>
                    {!isCompact && (
                        <button onClick={() => setTheme(theme === "light" ? "glass" : "light")} title="Toggle Theme" style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-dim)', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer' }}>
                            {theme === "light" ? <FaMoon /> : <FaSun />}
                        </button>
                    )}
                    <button className="logout" onClick={handleLogout} title="Logout" style={{ background: 'var(--input-bg)', border: 'none', color: '#ff4e4e', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer' }}>
                        <FaSignOutAlt />
                    </button>
                </div>
            </div>
        </div>
    );
}