// client/src/components/ChatSidePanel.jsx — Sprint 3: Gallery tab + Group Rules + QR invite
import React, { useState, useMemo } from "react";
import {
  FaTimes, FaSpinner, FaLink, FaFileDownload, FaAngleDown, FaCrown,
  FaShieldAlt, FaSignOutAlt, FaTrashAlt, FaExclamationTriangle,
  FaBell, FaBellSlash, FaSearch, FaPalette, FaInfoCircle, FaImage,
  FaQrcode, FaEdit, FaCheck, FaUsers, FaListUl,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { SideInfoPanel } from "./ChatContainer.styles";
import { getSmallAvatar, formatLastSeen } from "./chatHelpers";
import useChatStore from "../store/chatStore";
import axios from "axios";
import { toast } from "react-toastify";
import {
  promoteToModeratorRoute, demoteModeratorRoute,
  promoteToAdminRoute, kickMemberRoute,
  setGroupRulesRoute, setMaxMembersRoute,
  getGroupInviteCodeRoute,
} from "../utils/APIRoutes";

export default function ChatSidePanel({
  theme, currentChat, isOnline, lastSeen, activeSideTab,
  setActiveSideTab, setShowSidePanel, isFetchingMedia, chatMedia, setLightboxImage,
  handleWallpaperChange,
}) {
  const { currentUser, setCurrentChat } = useChatStore();
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // Existing feature states
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");

  // Sprint 3: Group rules editing
  const [editingRules, setEditingRules] = useState(false);
  const [rulesText, setRulesText] = useState(currentChat?.rules || "");
  const [savingRules, setSavingRules] = useState(false);

  // Sprint 3: Max member limit editing
  const [editingMaxMembers, setEditingMaxMembers] = useState(false);
  const [maxMembersValue, setMaxMembersValue] = useState(currentChat?.maxMembers || 0);
  const [savingMaxMembers, setSavingMaxMembers] = useState(false);

  // Sprint 3: QR invite
  const [showQRModal, setShowQRModal] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);

  const isGroup = currentChat?.admins !== undefined;
  const myRoleIsAdmin = isGroup && currentChat.admins?.includes(currentUser._id);
  const myRoleIsMod   = isGroup && currentChat.moderators?.includes(currentUser._id);

  const token = currentUser?.token || sessionStorage.getItem("chat-app-token");
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ── Member actions ────────────────────────────────────────────────────────
  const handleMemberAction = async (action, targetUserId) => {
    setLoadingAction(true);
    setActionMenuOpen(null);
    const previousChat = { ...currentChat };
    let optimisticChat = { ...currentChat };
    try {
      let res;
      if (action === "promote_admin") {
        optimisticChat.admins = [...(optimisticChat.admins || []), targetUserId];
        setCurrentChat(optimisticChat);
        res = await axios.post(promoteToAdminRoute, { groupId: currentChat._id, targetUserId }, authHeaders);
      } else if (action === "promote_mod") {
        optimisticChat.moderators = [...(optimisticChat.moderators || []), targetUserId];
        setCurrentChat(optimisticChat);
        res = await axios.post(promoteToModeratorRoute, { groupId: currentChat._id, targetUserId }, authHeaders);
      } else if (action === "demote_mod") {
        optimisticChat.moderators = optimisticChat.moderators.filter((id) => id !== targetUserId);
        setCurrentChat(optimisticChat);
        res = await axios.post(demoteModeratorRoute, { groupId: currentChat._id, targetUserId }, authHeaders);
      } else if (action === "kick") {
        optimisticChat.members = optimisticChat.members.filter((m) => (m._id || m) !== targetUserId);
        optimisticChat.admins = optimisticChat.admins?.filter((id) => id !== targetUserId);
        optimisticChat.moderators = optimisticChat.moderators?.filter((id) => id !== targetUserId);
        setCurrentChat(optimisticChat);
        res = await axios.post(kickMemberRoute, { groupId: currentChat._id, userId: targetUserId }, authHeaders);
      }
      if (res?.data?.status) toast.success("Member updated.");
      else { setCurrentChat(previousChat); toast.error("Failed to update member."); }
    } catch (error) {
      setCurrentChat(previousChat);
      toast.error(error.response?.data?.msg || "Action failed. Please try again.");
    } finally { setLoadingAction(false); }
  };

  // ── Sprint 3: Save group rules ────────────────────────────────────────────
  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const { data } = await axios.post(setGroupRulesRoute, { groupId: currentChat._id, rules: rulesText }, authHeaders);
      if (data.status) {
        setCurrentChat({ ...currentChat, rules: rulesText });
        toast.success("Group rules updated.");
        setEditingRules(false);
      }
    } catch { toast.error("Failed to save rules."); }
    finally { setSavingRules(false); }
  };

  // ── Sprint 3: Save max members ────────────────────────────────────────────
  const handleSaveMaxMembers = async () => {
    setSavingMaxMembers(true);
    try {
      const { data } = await axios.post(setMaxMembersRoute, { groupId: currentChat._id, maxMembers: Number(maxMembersValue) }, authHeaders);
      if (data.status) {
        setCurrentChat({ ...currentChat, maxMembers: data.maxMembers });
        toast.success(data.maxMembers === 0 ? "Member limit removed." : `Member limit set to ${data.maxMembers}.`);
        setEditingMaxMembers(false);
      }
    } catch { toast.error("Failed to update member limit."); }
    finally { setSavingMaxMembers(false); }
  };

  // ── Sprint 3: Load group QR invite code ──────────────────────────────────
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

  // ── Media filters ─────────────────────────────────────────────────────────
  const filteredLinks = useMemo(() =>
    chatMedia.links?.filter((m) => (m.linkMetadata?.title || m.message).toLowerCase().includes(mediaSearch.toLowerCase())) || [],
    [chatMedia.links, mediaSearch]
  );
  const filteredFiles = useMemo(() =>
    chatMedia.files?.filter((m) => (m.fileMetadata?.fileName || "").toLowerCase().includes(mediaSearch.toLowerCase())) || [],
    [chatMedia.files, mediaSearch]
  );

  const displayedMembers = showAllMembers ? currentChat.members : currentChat.members?.slice(0, 5);

  const tabVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: 0.1 } },
  };

  // Sprint 3: tabs — add "gallery" for groups
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

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
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
              <div className="about-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Hero profile */}
                <div className="profile-hero-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
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

                {/* Sprint 3: Group rules banner */}
                {isGroup && (currentChat.rules || myRoleIsAdmin || myRoleIsMod) && (
                  <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 12, padding: 15 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}>
                        <FaListUl /> Group Rules
                      </label>
                      {(myRoleIsAdmin || myRoleIsMod) && !editingRules && (
                        <button onClick={() => { setRulesText(currentChat.rules || ""); setEditingRules(true); }}
                          style={{ background: "transparent", border: "none", color: "var(--msg-sent)", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
                          <FaEdit /> Edit
                        </button>
                      )}
                    </div>
                    {editingRules ? (
                      <>
                        <textarea
                          value={rulesText} onChange={(e) => setRulesText(e.target.value)}
                          placeholder="Enter group rules…"
                          rows={4}
                          style={{ width: "100%", background: "var(--input-bg)", border: "1px solid var(--glass-border)", borderRadius: 8, color: "var(--text-main)", padding: "8px 10px", fontSize: "0.85rem", resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={handleSaveRules} disabled={savingRules}
                            style={{ flex: 1, background: "var(--msg-sent)", border: "none", color: "white", padding: "8px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>
                            {savingRules ? "Saving…" : <><FaCheck style={{ marginRight: 4 }} />Save</>}
                          </button>
                          <button onClick={() => setEditingRules(false)}
                            style={{ flex: 1, background: "var(--bg-overlay)", border: "1px solid var(--glass-border)", color: "var(--text-dim)", padding: "8px", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem" }}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "var(--text-main)", fontSize: "0.9rem", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                        {currentChat.rules || <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>No rules set yet.</span>}
                      </p>
                    )}
                  </div>
                )}

                {/* Info grid */}
                <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>

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

                  {/* Members */}
                  {isGroup && (
                    <div style={{ background: "var(--input-bg)", padding: 15, borderRadius: 12, border: "1px solid var(--glass-border)" }}>
                      <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, fontWeight: "bold" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <FaUsers /> Members ({currentChat.members?.length || 0}
                          {currentChat.maxMembers > 0 && ` / ${currentChat.maxMembers}`})
                        </span>
                        {loadingAction && <FaSpinner className="fa-spin" style={{ color: "var(--msg-sent)" }} />}
                      </label>

                      {/* Sprint 3: Max members edit (admin only) */}
                      {myRoleIsAdmin && (
                        <div style={{ marginBottom: 12 }}>
                          {editingMaxMembers ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input type="number" min={0} value={maxMembersValue} onChange={(e) => setMaxMembersValue(e.target.value)}
                                style={{ flex: 1, background: "var(--bg-overlay)", border: "1px solid var(--glass-border)", borderRadius: 6, color: "var(--text-main)", padding: "6px 10px", fontSize: "0.8rem", outline: "none" }} />
                              <button onClick={handleSaveMaxMembers} disabled={savingMaxMembers}
                                style={{ background: "var(--msg-sent)", border: "none", color: "white", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                                {savingMaxMembers ? "…" : "Save"}
                              </button>
                              <button onClick={() => setEditingMaxMembers(false)}
                                style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "0.75rem" }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setMaxMembersValue(currentChat.maxMembers || 0); setEditingMaxMembers(true); }}
                              style={{ background: "transparent", border: "none", color: "var(--msg-sent)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                              <FaEdit /> {currentChat.maxMembers > 0 ? `Limit: ${currentChat.maxMembers}` : "Set member limit"}
                            </button>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {displayedMembers?.map((member) => {
                          const memberId    = member._id || member;
                          const memberName  = member.username || "User";
                          const isUserAdmin = currentChat.admins?.includes(memberId);
                          const isUserMod   = currentChat.moderators?.includes(memberId);
                          const isMe        = memberId === currentUser._id;
                          const canKick          = (myRoleIsAdmin && !isMe) || (myRoleIsMod && !isUserAdmin && !isUserMod && !isMe);
                          const canPromoteToMod  = myRoleIsAdmin && !isUserAdmin && !isUserMod && !isMe;
                          const canPromoteToAdmin = myRoleIsAdmin && !isUserAdmin && !isMe;
                          const canDemoteMod     = myRoleIsAdmin && isUserMod && !isUserAdmin && !isMe;
                          const hasActions       = canKick || canPromoteToMod || canPromoteToAdmin || canDemoteMod;

                          return (
                            <div key={memberId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <img src={getSmallAvatar(memberName)} alt="av" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ color: "var(--text-main)", fontSize: "0.9rem", fontWeight: 500 }}>
                                  {memberName} {isMe && <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>(You)</span>}
                                </span>
                                {isUserAdmin && <FaCrown title="Admin" style={{ color: "#10b981", fontSize: "0.8rem" }} />}
                                {isUserMod && !isUserAdmin && <FaShieldAlt title="Moderator" style={{ color: "#34B7F1", fontSize: "0.8rem" }} />}
                              </div>
                              {hasActions && (
                                <div style={{ position: "relative" }}>
                                  <button onClick={() => setActionMenuOpen(actionMenuOpen === memberId ? null : memberId)} disabled={loadingAction}
                                    style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4 }}>
                                    <FaAngleDown />
                                  </button>
                                  {actionMenuOpen === memberId && (
                                    <div style={{ position: "absolute", right: 0, top: "100%", background: "var(--bg-panel)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: 4, zIndex: 10, width: 140, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                                      {canPromoteToAdmin && <button style={{ width: "100%", padding: 8, background: "transparent", border: "none", color: "var(--text-main)", textAlign: "left", cursor: "pointer", fontSize: "0.8rem" }} onClick={() => handleMemberAction("promote_admin", memberId)}>Make Admin</button>}
                                      {canPromoteToMod   && <button style={{ width: "100%", padding: 8, background: "transparent", border: "none", color: "var(--text-main)", textAlign: "left", cursor: "pointer", fontSize: "0.8rem" }} onClick={() => handleMemberAction("promote_mod",   memberId)}>Make Moderator</button>}
                                      {canDemoteMod      && <button style={{ width: "100%", padding: 8, background: "transparent", border: "none", color: "#f59e0b",          textAlign: "left", cursor: "pointer", fontSize: "0.8rem" }} onClick={() => handleMemberAction("demote_mod",    memberId)}>Remove Mod</button>}
                                      {canKick           && <button style={{ width: "100%", padding: 8, background: "transparent", border: "none", color: "#ef4444",          textAlign: "left", cursor: "pointer", fontSize: "0.8rem" }} onClick={() => handleMemberAction("kick",          memberId)}>Kick Member</button>}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {currentChat.members?.length > 5 && (
                          <button onClick={() => setShowAllMembers(!showAllMembers)}
                            style={{ background: "transparent", border: "none", color: "var(--msg-sent)", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer", marginTop: 5, textAlign: "left" }}>
                            {showAllMembers ? "Show Less" : `View All ${currentChat.members?.length} Members`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

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
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
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

                  {/* Sprint 3: QR invite button for groups */}
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
              </div>
            ) : (
              /* Media / Links / Files */
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ position: "relative", marginBottom: 20 }}>
                  <FaSearch style={{ position: "absolute", left: 12, top: 12, color: "var(--text-dim)" }} />
                  <input placeholder={`Search ${activeSideTab}...`} value={mediaSearch} onChange={(e) => setMediaSearch(e.target.value)}
                    style={{ width: "100%", padding: "10px 10px 10px 36px", borderRadius: 8, background: "var(--input-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)", outline: "none" }} />
                </div>

                {isFetchingMedia ? (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}><FaSpinner className="fa-spin" size={24} /></div>
                ) : (
                  <>
                    {activeSideTab === "media" && (
                      chatMedia.media.length === 0
                        ? <p style={{ textAlign: "center", color: "var(--text-dim)", fontStyle: "italic", marginTop: 20 }}>No media shared yet.</p>
                        : <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                          {chatMedia.media.map((m) => (
                            <div key={m.id} style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "var(--input-bg)" }}>
                              {m.type === "image"
                                ? <img src={m.message} alt="shared" style={{ width: "100%", height: "100%", objectFit: "cover" }} onClick={() => setLightboxImage(m.message)} />
                                : <video src={m.message} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              }
                            </div>
                          ))}
                        </div>
                    )}

                    {activeSideTab === "links" && (
                      filteredLinks.length === 0
                        ? <p style={{ textAlign: "center", color: "var(--text-dim)", fontStyle: "italic", marginTop: 20 }}>No matching links found.</p>
                        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {filteredLinks.map((m) => (
                            <a key={m.id} href={m.linkMetadata?.url || m.message} target="_blank" rel="noreferrer"
                              style={{ display: "flex", gap: 12, padding: 12, background: "var(--input-bg)", borderRadius: 12, border: "1px solid var(--glass-border)", textDecoration: "none" }}>
                              <div style={{ width: 40, height: 40, background: "rgba(52,183,241,0.1)", color: "#34B7F1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaLink /></div>
                              <div style={{ overflow: "hidden" }}>
                                <h4 style={{ color: "var(--text-main)", fontSize: "0.9rem", margin: "0 0 4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.linkMetadata?.title || m.message}</h4>
                                <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.linkMetadata?.url || m.message}</p>
                              </div>
                            </a>
                          ))}
                        </div>
                    )}

                    {activeSideTab === "files" && (
                      filteredFiles.length === 0
                        ? <p style={{ textAlign: "center", color: "var(--text-dim)", fontStyle: "italic", marginTop: 20 }}>No matching files found.</p>
                        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {filteredFiles.map((m) => (
                            <a key={m.id} href={m.message} target="_blank" rel="noreferrer"
                              style={{ display: "flex", gap: 12, padding: 12, background: "var(--input-bg)", borderRadius: 12, border: "1px solid var(--glass-border)", textDecoration: "none" }}>
                              <div style={{ width: 40, height: 40, background: "rgba(16,185,129,0.1)", color: "#10b981", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaFileDownload /></div>
                              <div style={{ overflow: "hidden" }}>
                                <h4 style={{ color: "var(--text-main)", fontSize: "0.9rem", margin: "0 0 4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.fileMetadata?.fileName || "Attachment"}</h4>
                                <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", margin: 0 }}>{m.fileMetadata?.fileSize || "Unknown Size"}</p>
                              </div>
                            </a>
                          ))}
                        </div>
                    )}
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </SideInfoPanel>
  );
}
