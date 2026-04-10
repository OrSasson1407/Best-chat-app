import React, { useState } from "react";
import { FaSpinner, FaCrown, FaShieldAlt, FaAngleDown, FaEdit, FaCheck, FaUsers, FaListUl } from "react-icons/fa";
import axios from "axios";
import { toast } from "react-toastify";
import useChatStore from "../../../store/chatStore";
import { getSmallAvatar } from "../../Sidebar/ContactList/chatHelpers";
import {
  promoteToModeratorRoute, demoteModeratorRoute,
  promoteToAdminRoute, kickMemberRoute,
  setGroupRulesRoute, setMaxMembersRoute
} from "../../../utils/APIRoutes";

export default function GroupManagement({ currentChat, isGroup, myRoleIsAdmin, myRoleIsMod, authHeaders }) {
  const { currentUser, setCurrentChat } = useChatStore();
  
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);

  // Group rules editing
  const [editingRules, setEditingRules] = useState(false);
  const [rulesText, setRulesText] = useState(currentChat?.rules || "");
  const [savingRules, setSavingRules] = useState(false);

  // Max member limit editing
  const [editingMaxMembers, setEditingMaxMembers] = useState(false);
  const [maxMembersValue, setMaxMembersValue] = useState(currentChat?.maxMembers || 0);
  const [savingMaxMembers, setSavingMaxMembers] = useState(false);

  if (!isGroup) return null;

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

  const displayedMembers = showAllMembers ? currentChat.members : currentChat.members?.slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 15, marginTop: 15 }}>
      {/* Group Rules Banner */}
      {(currentChat.rules || myRoleIsAdmin || myRoleIsMod) && (
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

      {/* Members Section */}
      <div style={{ background: "var(--input-bg)", padding: 15, borderRadius: 12, border: "1px solid var(--glass-border)" }}>
        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, fontWeight: "bold" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaUsers /> Members ({currentChat.members?.length || 0}
            {currentChat.maxMembers > 0 && ` / ${currentChat.maxMembers}`})
          </span>
          {loadingAction && <FaSpinner className="fa-spin" style={{ color: "var(--msg-sent)" }} />}
        </label>

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
    </div>
  );
}