import React, { useState } from "react";
import { FaPalette, FaBell, FaBellSlash, FaQrcode, FaSignOutAlt, FaTrashAlt, FaExclamationTriangle, FaSpinner } from "react-icons/fa";
import { getSmallAvatar, formatLastSeen } from "../../Sidebar/ContactList/chatHelpers";

export default function AboutSection({ currentChat, isGroup, isOnline, lastSeen, handleWallpaperChange, handleShowQR, loadingQR }) {
  const [isMuted, setIsMuted] = useState(false);

  return (
    <>
      {/* Hero profile */}
      <div className="profile-hero-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
        <div className="avatar-wrapper" style={{ position: "relative", width: 100, height: 100, marginBottom: 15 }}>
          <img
            src={currentChat.avatarImage ? `https://avatar.iran.liara.run/public/${currentChat.avatarImage}` : getSmallAvatar(currentChat.name || currentChat.username)}
            alt="hero"
            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "3px solid var(--glass-border)" }}
          />
          {!isGroup && isOnline && (
            <div style={{ position: "absolute", bottom: 5, right: 5, width: 18, height: 18, background: "#10b981", borderRadius: "50%", border: "3px solid var(--bg-panel)", boxShadow: "0 0 10px rgba(16,185,129,0.5)" }} />
          )}
        </div>
        <h3 style={{ fontSize: "1.4rem", color: "var(--text-main)", marginBottom: 5 }}>{currentChat.name || currentChat.username}</h3>
        <p style={{
          color: isGroup ? (currentChat.isPublic ? "#34B7F1" : "#10b981") : (isOnline ? "#10b981" : "var(--text-dim)"),
          background: isGroup ? (currentChat.isPublic ? "rgba(52,183,241,0.1)" : "rgba(16,185,129,0.1)") : (isOnline ? "rgba(16,185,129,0.1)" : "transparent"),
          padding: "4px 12px", borderRadius: 12, fontSize: "0.85rem", display: "inline-block",
        }}>
          {isGroup ? (currentChat.isPublic ? "Public Channel" : "Private Group") : (isOnline ? "Online Now" : formatLastSeen(lastSeen))}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {/* Info Box */}
        <div style={{ background: "var(--input-bg)", padding: 15, borderRadius: 12, border: "1px solid var(--glass-border)" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontWeight: "bold" }}>About</label>
          <p style={{ color: "var(--text-main)", fontSize: "0.95rem", lineHeight: 1.5, margin: 0 }}>
            {currentChat.description || currentChat.bio || "No description provided."}
          </p>
          {!isGroup && currentChat.interests?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {currentChat.interests.map((i, idx) => (
                <span key={idx} style={{ background: "var(--bg-panel)", color: "var(--text-main)", fontSize: "0.75rem", padding: "4px 10px", borderRadius: 12, border: "1px solid var(--glass-border)" }}>{i}</span>
              ))}
            </div>
          )}
        </div>

        {/* Appearance */}
        <div style={{ background: "var(--input-bg)", padding: 15, borderRadius: 12, border: "1px solid var(--glass-border)" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, fontWeight: "bold" }}>
            <FaPalette style={{ marginRight: 5 }} /> Appearance
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {["#050510", "linear-gradient(135deg, #1f005c, #5b0060)", "linear-gradient(135deg, #004d40, #000000)"].map((bg, i) => (
              <div key={i} style={{ width: 40, height: 40, borderRadius: 8, background: bg, cursor: "pointer", border: "2px solid var(--glass-border)" }} onClick={() => handleWallpaperChange(bg)} />
            ))}
            <button onClick={() => handleWallpaperChange("transparent")}
              style={{ height: 40, padding: "0 12px", borderRadius: 8, background: "var(--bg-panel)", border: "1px solid var(--glass-border)", color: "var(--text-main)", cursor: "pointer", fontSize: "0.8rem" }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 15 }}>
        <button onClick={() => setIsMuted(!isMuted)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--input-bg)", padding: 15, borderRadius: 12, border: "1px solid var(--glass-border)", color: "var(--text-main)", cursor: "pointer", fontSize: "0.95rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isMuted ? <FaBellSlash style={{ color: "#ef4444" }} /> : <FaBell style={{ color: "var(--msg-sent)" }} />}
            <span style={{ fontWeight: 500 }}>Mute Notifications</span>
          </div>
          <div style={{ width: 40, height: 24, background: isMuted ? "#ef4444" : "var(--glass-border)", borderRadius: 20, position: "relative", transition: "0.3s" }}>
            <div style={{ position: "absolute", top: 2, left: isMuted ? 18 : 2, width: 20, height: 20, background: "#fff", borderRadius: "50%", transition: "0.3s" }} />
          </div>
        </button>

        {isGroup && (
          <button onClick={handleShowQR} disabled={loadingQR}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(124,58,237,0.08)", padding: 15, borderRadius: 12, border: "1px solid rgba(124,58,237,0.2)", color: "var(--msg-sent)", cursor: "pointer", fontSize: "0.95rem", fontWeight: 500 }}>
            {loadingQR ? <FaSpinner className="fa-spin" /> : <FaQrcode />}
            <span>Invite via QR Code</span>
          </button>
        )}

        {isGroup && (
          <button style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,0.1)", padding: 15, borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", cursor: "pointer", fontSize: "0.95rem", fontWeight: 500 }}>
            <FaSignOutAlt /><span>Leave Group</span>
          </button>
        )}
        <button style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,0.1)", padding: 15, borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", cursor: "pointer", fontSize: "0.95rem", fontWeight: 500 }}>
          <FaTrashAlt /><span>Clear Conversation</span>
        </button>
        <button style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--input-bg)", padding: 15, borderRadius: 12, border: "1px solid var(--glass-border)", color: "#ef4444", cursor: "pointer", fontSize: "0.95rem", fontWeight: 500 }}>
          <FaExclamationTriangle /><span>Report Chat</span>
        </button>
      </div>
    </>
  );
}