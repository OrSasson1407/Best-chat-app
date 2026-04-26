import React, { useState } from "react";
import { FaTimes, FaInfoCircle, FaImage, FaLink, FaFileDownload } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import axios from "axios";
import { toast } from "react-toastify";
import useChatStore from "../../../store/chatStore";
import { getGroupInviteCodeRoute } from "../../../utils/APIRoutes";

import { SideInfoPanel } from "./SidePanel.styles";
import AboutSection from "./AboutSection";
import GroupManagement from "./GroupManagement";
import SharedContent from "./SharedContent";

export default function SidePanel({
  theme, currentChat, isOnline, lastSeen, activeSideTab,
  setActiveSideTab, setShowSidePanel, isFetchingMedia, chatMedia, setLightboxImage,
  handleWallpaperChange,
}) {
  const { currentUser } = useChatStore();
  
  // Sprint 3: QR invite state
  const [showQRModal, setShowQRModal] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);

  // BUG-012 FIX: Use a reliable structural check — a group always has both
  // a members array and an admins array. Checking admins !== undefined is
  // fragile; Array.isArray guards against null/undefined and partial objects.
  const isGroup = Array.isArray(currentChat?.admins) && Array.isArray(currentChat?.members);

  // BUG-004 FIX: admins/moderators contain MongoDB ObjectIds; currentUser._id
  // is a plain string. Array.includes() uses strict equality so ObjectId !==
  // string always — every admin saw their controls hidden. Use .some() with
  // an explicit .toString() comparison on both sides.
  const myRoleIsAdmin = isGroup && (currentChat.admins ?? []).some(
    (id) => id.toString() === currentUser._id.toString()
  );
  const myRoleIsMod = isGroup && (currentChat.moderators ?? []).some(
    (id) => id.toString() === currentUser._id.toString()
  );

  const token = currentUser?.token || sessionStorage.getItem("chat-app-token");
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const handleShowQR = async () => {
    if (inviteCode) { setShowQRModal(true); return; }
    setLoadingQR(true);
    try {
      const { data } = await axios.get(`${getGroupInviteCodeRoute}/${currentChat._id}`, authHeaders);
      if (data.status) {
        setInviteCode(data.inviteCode);
        setShowQRModal(true);
      }
    } catch { toast.error("Failed to load invite code."); }
    finally { setLoadingQR(false); }
  };

  const inviteLink = inviteCode ? `${window.location.origin}/join/${inviteCode}` : "";

  const tabVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: 0.1 } },
  };

  const tabs = [
    { id: "about",  label: "Info",    icon: <FaInfoCircle /> },
    { id: "media",  label: "Media",   icon: <FaImage /> },
    { id: "links",  label: "Links",   icon: <FaLink /> },
    { id: "files",  label: "Files",   icon: <FaFileDownload /> },
  ];

  return (
    <SideInfoPanel $themeType={theme}>
      {/* ── QR Modal (Sprint 3) ────────────────────────────────────────────── */}
      {showQRModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowQRModal(false)}>
          <div style={{ background: "var(--bg-panel)", borderRadius: "var(--radius-xl)", padding: "2rem", border: "1px solid var(--glass-border)", maxWidth: 320, width: "95vw", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: "1.1rem" }}>Invite via QR Code</h3>
            <div style={{ background: "white", padding: 16, borderRadius: 12 }}>
              <QRCode value={inviteLink} size={180} />
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", textAlign: "center", margin: 0 }}>
              Scan to join <strong style={{ color: "var(--text-primary)" }}>{currentChat.name}</strong>
            </p>
            <div style={{ background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: "8px 14px", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inviteCode}</span>
              <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Invite link copied!"); }}
                style={{ background: "var(--msg-sent)", border: "none", color: "white", padding: "4px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>
                Copy
              </button>
            </div>
            <button onClick={() => setShowQRModal(false)}
              style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.85rem" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Panel Header ──────────────────────────────────────────────────── */}
      <div className="panel-header">
        <div className="header-title-set" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FaInfoCircle className="header-icon" style={{ color: "var(--msg-sent)" }} />
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
            {activeSideTab === "about" ? (isGroup ? "Group Info" : "Contact Info") : "Shared Content"}
          </h3>
        </div>
        <button className="close-panel-btn" onClick={() => setShowSidePanel(false)}
          style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "1.2rem" }}>
          <FaTimes />
        </button>
      </div>

      {/* ── Tabs Navigation ───────────────────────────────────────────────── */}
      <div className="tabs-navigation" style={{ display: "flex", gap: 8, padding: "0 20px 15px", borderBottom: "1px solid var(--glass-border)" }}>
        {tabs.map((tab) => (
          <button key={tab.id} className={activeSideTab === tab.id ? "active" : ""} onClick={() => setActiveSideTab(tab.id)}
            style={{
              flex: 1, padding: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: activeSideTab === tab.id ? "var(--input-bg)" : "transparent",
              border: "1px solid", borderColor: activeSideTab === tab.id ? "var(--glass-border)" : "transparent",
              borderRadius: 8, color: activeSideTab === tab.id ? "var(--text-main)" : "var(--text-dim)",
              cursor: "pointer", transition: "0.2s", fontSize: "0.75rem",
            }}>
            <span style={{ fontSize: "1rem" }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Panel Content ────────────────────────────────────────────────── */}
      <div className="panel-content" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeSideTab} variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="tab-content-wrapper">

            {activeSideTab === "about" ? (
              <div className="about-section" style={{ display: "flex", flexDirection: "column" }}>
                <AboutSection 
                  currentChat={currentChat} 
                  isGroup={isGroup} 
                  isOnline={isOnline} 
                  lastSeen={lastSeen} 
                  handleWallpaperChange={handleWallpaperChange}
                  handleShowQR={handleShowQR}
                  loadingQR={loadingQR}
                />
                
                <GroupManagement 
                  currentChat={currentChat} 
                  isGroup={isGroup} 
                  myRoleIsAdmin={myRoleIsAdmin} 
                  myRoleIsMod={myRoleIsMod} 
                  authHeaders={authHeaders} 
                />
              </div>
            ) : (
              <SharedContent 
                activeSideTab={activeSideTab} 
                isFetchingMedia={isFetchingMedia} 
                chatMedia={chatMedia} 
                setLightboxImage={setLightboxImage} 
              />
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </SideInfoPanel>
  );
}