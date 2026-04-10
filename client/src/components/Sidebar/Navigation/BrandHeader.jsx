import React from "react";
import { motion } from "framer-motion";
import { FaUserFriends, FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function BrandHeader({ 
    isCompact, 
    setIsCompact, 
    showFriendRequests, 
    setShowFriendRequests, 
    pendingRequestCount 
}) {
    return (
        <div className="brand-area" style={{ padding: isCompact ? "20px 0" : "24px", display: 'flex', justifyContent: isCompact ? 'center' : 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {!isCompact && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <motion.h3 
                        style={{ color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '2px', margin: 0 }} 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                    >
                        SNAPPY
                    </motion.h3>
                    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowFriendRequests(!showFriendRequests)} title="Contact requests">
                        <FaUserFriends style={{ color: 'var(--text-secondary)', fontSize: '1rem' }} />
                        {pendingRequestCount > 0 && (
                            <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--msg-sent)', color: 'white', fontSize: '0.6rem', fontWeight: 800, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {pendingRequestCount}
                            </span>
                        )}
                    </div>
                </div>
            )}
            <button 
                className="sidebar-toggle-trigger" 
                onClick={() => setIsCompact(!isCompact)}
                style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-dim)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
                {isCompact ? <FaChevronRight /> : <FaChevronLeft />}
            </button>
        </div>
    );
}