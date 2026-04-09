import React from "react";
import { motion } from "framer-motion";
import { FaShieldAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { ModalOverlay } from "./Contacts.styles";
export default function ProfileSettingsModal({
    setShowProfileModal,
    profileData,
    setProfileData,
    avatarPreview,
    setAvatarPreview,
    handleAvatarUpload,
    avatarUploadRef,
    getAvatarUrl,
    currentUser,
    theme,
    setTheme,
    isCompact,
    setIsCompact,
    hasPin,
    setHasPin,
    handleUpdateProfile
}) {
    return (
        <ModalOverlay as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-content profile" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
                <h3>Profile & Settings</h3>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ position: "relative", width: "80px", height: "80px", cursor: "pointer" }} onClick={() => avatarUploadRef.current?.click()}>
                        <img
                            src={avatarPreview || getAvatarUrl(currentUser)}
                            alt="avatar"
                            style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "3px solid var(--msg-sent)" }}
                        />
                        <div style={{ position: "absolute", bottom: 0, right: 0, width: "26px", height: "26px", borderRadius: "50%", background: "var(--msg-sent)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--bg-panel)" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                        </div>
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                        {avatarPreview ? "New photo selected — save to apply" : "Click to change profile photo"}
                    </span>
                    {avatarPreview && (
                        <button type="button" onClick={() => setAvatarPreview(null)} style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                            Cancel
                        </button>
                    )}
                    <input ref={avatarUploadRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                </div>
                
                <div className="input-field">
                    <label>Theme</label>
                    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                        <option value="glass">Glassmorphism</option>
                        <option value="midnight">Midnight (OLED)</option>
                        <option value="cyberpunk">Cyberpunk</option>
                        <option value="light">Light Mode</option>
                    </select>
                </div>
                
                <div className="input-field">
                    <label>Compact Mode</label>
                    <button className={`toggle-btn ${isCompact ? "on" : ""}`} onClick={() => setIsCompact(!isCompact)}>
                        {isCompact ? "Enabled" : "Disabled"}
                    </button>
                </div>

                <div className="section-divider"><FaShieldAlt /> Privacy & Security</div>

                <div className="grid-2">
                    <div className="input-field">
                        <label>Last Seen</label>
                        <select value={profileData.privacySettings.lastSeen} onChange={(e) => setProfileData({ ...profileData, privacySettings: { ...profileData.privacySettings, lastSeen: e.target.value } })}>
                            <option value="everyone">Everyone</option>
                            <option value="nobody">Nobody</option>
                        </select>
                    </div>
                    <div className="input-field">
                        <label>Profile Photo</label>
                        <select value={profileData.privacySettings.profilePhoto} onChange={(e) => setProfileData({ ...profileData, privacySettings: { ...profileData.privacySettings, profilePhoto: e.target.value } })}>
                            <option value="everyone">Everyone</option>
                            <option value="nobody">Nobody</option>
                        </select>
                    </div>
                </div>

                <div className="setting-row">
                    <div className="text">
                        <label>Read Receipts</label>
                        <p>Show blue ticks when you read messages.</p>
                    </div>
                    <div className={`ios-switch ${profileData.privacySettings.readReceipts ? "on" : "off"}`} onClick={() => setProfileData({ ...profileData, privacySettings: { ...profileData.privacySettings, readReceipts: !profileData.privacySettings.readReceipts } })}>
                        <div className="knob" />
                    </div>
                </div>

                <div className="setting-row">
                    <div className="text">
                        <label>App Lock (PIN)</label>
                        <p>Require a 4-digit PIN to open the app.</p>
                    </div>
                    <div className={`ios-switch ${hasPin ? "on" : "off"}`} onClick={() => {
                        if (hasPin) {
                            localStorage.removeItem("app-pin-code");
                            setHasPin(false);
                            toast.info("App Lock disabled.");
                        } else {
                            const newPin = prompt("Enter a 4-digit PIN:");
                            if (newPin && newPin.length === 4 && !isNaN(newPin)) {
                                localStorage.setItem("app-pin-code", newPin);
                                setHasPin(true);
                                toast.success("App Lock enabled.");
                            } else if (newPin) toast.error("Invalid PIN. Please enter 4 numbers.");
                        }
                    }}>
                        <div className="knob" />
                    </div>
                </div>

                <div className="section-divider">Public Profile</div>

                <div className="input-field multi">
                    <label>Status Icon & Message</label>
                    <div className="flex-row">
                        <input type="text" maxLength="2" value={profileData.statusIcon} onChange={(e) => setProfileData({ ...profileData, statusIcon: e.target.value })} style={{ width: "60px", textAlign: "center" }} />
                        <input type="text" placeholder="What's on your mind?" maxLength="50" value={profileData.statusMessage} onChange={(e) => setProfileData({ ...profileData, statusMessage: e.target.value })} style={{ flex: 1 }} />
                    </div>
                </div>
                <div className="input-field">
                    <label>Bio</label>
                    <textarea placeholder="Tell people about yourself..." value={profileData.bio} onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })} />
                </div>

                <div className="button-group" style={{ marginTop: "20px" }}>
                    <button className="btn-secondary" onClick={() => setShowProfileModal(false)}>Cancel</button>
                    <button className="btn-primary" onClick={handleUpdateProfile}>Save Changes</button>
                </div>
            </motion.div>
        </ModalOverlay>
    );
}