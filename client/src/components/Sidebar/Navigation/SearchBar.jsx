import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSearch, FaTimes } from "react-icons/fa";

export default function SearchBar({ 
    isCompact, 
    activeFolder, 
    searchTerm, 
    setSearchTerm 
}) {
    // Local state for the focus outline effect
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    if (isCompact) return null; // Hides entirely when sidebar is compact

    return (
        <div className={`search-container ${isSearchFocused ? "focused" : ""}`} style={{ flexShrink: 0, padding: '0 16px', marginBottom: '16px' }}>
            <motion.div 
                className="search-box" 
                animate={{ borderColor: isSearchFocused ? "var(--msg-sent)" : "var(--glass-border)" }} 
                style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', borderRadius: '16px', padding: '0 16px', border: '1px solid var(--glass-border)' }}
            >
                <FaSearch className="icon search-icon" style={{ color: 'var(--text-dim)' }} />
                <input
                    type="text"
                    placeholder={`Search ${activeFolder}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px', color: 'var(--text-main)', outline: 'none' }}
                />
                <AnimatePresence>
                    {searchTerm && (
                        <motion.div 
                            initial={{ scale: 0, rotate: -90 }} 
                            animate={{ scale: 1, rotate: 0 }} 
                            exit={{ scale: 0, rotate: 90 }} 
                            className="icon clear-icon" 
                            onClick={() => setSearchTerm("")} 
                            style={{ cursor: 'pointer', color: 'var(--text-dim)' }}
                        >
                            <FaTimes />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}