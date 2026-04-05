// client/src/components/UserProfile.jsx — Sprint 2: Dedicated User Profile Modal
import React, { useEffect, useState, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FaTimes, FaUserPlus, FaUserCheck, FaBan, FaEnvelope,
  FaClock, FaInfoCircle, FaHeart, FaShieldAlt,
} from "react-icons/fa";
import {
  getUserByIdRoute, sendFriendRequestRoute, blockUserRoute,
} from "../utils/APIRoutes";
import useChatStore from "../store/chatStore";

export default function UserProfile({ userId, onClose, onStartChat }) {
  const { currentUser } = useChatStore();
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [isBlocked, setIsBlocked]   = useState(false);

  const token   = currentUser?.token || sessionStorage.getItem("chat-app-token");
  const headers = { Authorization: `Bearer ${token}` };

  const isAlreadyContact = currentUser?.contacts?.map(String).includes(String(userId));
  const isSelf = String(currentUser?._id) === String(userId);

  // ── Fetch profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    axios
      .get(`${getUserByIdRoute}/${userId}`, { headers })
      .then(({ data }) => {
        if (data.status) setProfile(data.user);
        else toast.error("Could not load profile.");
      })
      .catch(() => toast.error("Failed to fetch profile."))
      .finally(() => setLoading(false));

    setIsBlocked(currentUser?.blockedUsers?.map(String).includes(String(userId)) ?? false);
  }, [userId]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatLastSeen = (dateStr) => {
    if (!dateStr) return "Unknown";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (mins < 1)   return "Just now";
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  };

  const handleSendRequest = async () => {
    try {
      const { data } = await axios.post(sendFriendRequestRoute, { toId: userId }, { headers });
      if (data.status) { setRequestSent(true); toast.success("Friend request sent!"); }
      else toast.info(data.msg);
    } catch { toast.error("Failed to send request."); }
  };

  const handleBlock = async () => {
    if (!window.confirm(isBlocked ? "Unblock this user?" : "Block this user?")) return;
    try {
      const { data } = await axios.post(blockUserRoute, { userId: currentUser._id, blockedUserId: userId }, { headers });
      if (data.status) {
        setIsBlocked(!isBlocked);
        toast.success(isBlocked ? "User unblocked." : "User blocked.");
      }
    } catch { toast.error("Failed to update block status."); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <CloseBtn onClick={onClose}><FaTimes /></CloseBtn>

        {loading ? (
          <LoadingState>
            <div className="spinner" />
            <p>Loading profile…</p>
          </LoadingState>
        ) : !profile ? (
          <LoadingState><p>Profile not found.</p></LoadingState>
        ) : (
          <>
            {/* ── Header / Avatar ── */}
            <ProfileHeader>
              <AvatarRing>
                <img src={profile.avatarImage || `https://api.dicebear.com/9.x/avataaars/svg?seed=${profile.username}`} alt={profile.username} />
              </AvatarRing>
              <div className="name-block">
                <h2>{profile.username}</h2>
                <p className="status">
                  <span className="icon">{profile.statusIcon || "💬"}</span>
                  {profile.statusMessage || "Available"}
                </p>
              </div>
            </ProfileHeader>

            {/* ── Info rows ── */}
            <InfoGrid>
              {profile.bio && (
                <InfoRow>
                  <FaInfoCircle className="row-icon" />
                  <div>
                    <span className="label">Bio</span>
                    <span className="value">{profile.bio}</span>
                  </div>
                </InfoRow>
              )}
              {profile.interests?.length > 0 && (
                <InfoRow>
                  <FaHeart className="row-icon" />
                  <div>
                    <span className="label">Interests</span>
                    <div className="tags">
                      {profile.interests.map((i, idx) => <Tag key={idx}>{i}</Tag>)}
                    </div>
                  </div>
                </InfoRow>
              )}
              <InfoRow>
                <FaClock className="row-icon" />
                <div>
                  <span className="label">Last seen</span>
                  <span className="value">{formatLastSeen(profile.lastSeen)}</span>
                </div>
              </InfoRow>
            </InfoGrid>

            {/* ── Actions ── */}
            {!isSelf && (
              <Actions>
                {!isBlocked && (
                  <ActionBtn $primary onClick={() => { onStartChat(profile); onClose(); }}>
                    <FaEnvelope /> Message
                  </ActionBtn>
                )}

                {!isAlreadyContact && !requestSent && !isBlocked && (
                  <ActionBtn onClick={handleSendRequest}>
                    <FaUserPlus /> Add contact
                  </ActionBtn>
                )}

                {(isAlreadyContact || requestSent) && !isBlocked && (
                  <ActionBtn $muted disabled>
                    <FaUserCheck /> {isAlreadyContact ? "Contact" : "Request sent"}
                  </ActionBtn>
                )}

                <ActionBtn $danger onClick={handleBlock}>
                  <FaBan /> {isBlocked ? "Unblock" : "Block"}
                </ActionBtn>
              </Actions>
            )}
          </>
        )}
      </Modal>
    </Overlay>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const fadeIn = keyframes`from{opacity:0;transform:scale(0.95) translateY(12px);}to{opacity:1;transform:scale(1) translateY(0);}`;

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
`;

const Modal = styled.div`
  position: relative;
  background: var(--bg-panel); border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl); width: min(420px, 95vw);
  box-shadow: 0 32px 80px rgba(0,0,0,0.5);
  animation: ${fadeIn} 0.25s var(--ease-spring);
  overflow: hidden;
`;

const CloseBtn = styled.button`
  position: absolute; top: 14px; right: 14px;
  background: var(--bg-overlay); border: none; border-radius: 50%;
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-secondary); font-size: 0.9rem;
  transition: all var(--duration-fast);
  &:hover { background: var(--bg-hover); color: var(--color-danger); }
`;

const LoadingState = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 3rem 2rem; color: var(--text-secondary); font-size: var(--text-sm);
  .spinner {
    width: 28px; height: 28px; border: 3px solid var(--border-subtle);
    border-top-color: var(--msg-sent); border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const ProfileHeader = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 2.5rem 2rem 1.5rem;
  background: linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 100%);
  border-bottom: 1px solid var(--border-subtle);

  .name-block { text-align: center; }
  h2 { font-size: var(--text-xl); font-weight: 800; color: var(--text-primary); margin: 0 0 4px; }
  .status {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    font-size: var(--text-sm); color: var(--text-secondary);
    .icon { font-size: 1rem; }
  }
`;

const AvatarRing = styled.div`
  width: 88px; height: 88px; border-radius: 50%;
  border: 3px solid var(--msg-sent); padding: 3px;
  box-shadow: 0 0 0 1px rgba(124,58,237,0.2), 0 8px 24px rgba(0,0,0,0.3);
  img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
`;

const InfoGrid = styled.div`
  display: flex; flex-direction: column; gap: 0;
  padding: 0.5rem 0;
`;

const InfoRow = styled.div`
  display: flex; align-items: flex-start; gap: 14px;
  padding: 12px 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  &:last-child { border-bottom: none; }

  .row-icon { color: var(--msg-sent); font-size: 0.9rem; margin-top: 3px; flex-shrink: 0; }
  div { display: flex; flex-direction: column; gap: 3px; }
  .label { font-size: var(--text-2xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-secondary); }
  .value { font-size: var(--text-sm); color: var(--text-primary); line-height: 1.5; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
`;

const Tag = styled.span`
  background: rgba(124,58,237,0.1); color: var(--msg-sent);
  border: 1px solid rgba(124,58,237,0.2); border-radius: var(--radius-full);
  padding: 3px 10px; font-size: var(--text-2xs); font-weight: 600;
`;

const Actions = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px; padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--border-subtle);
`;

const ActionBtn = styled.button`
  display: flex; align-items: center; gap: 7px; flex: 1; min-width: 120px;
  padding: 10px 14px; border-radius: var(--radius-md); font-size: var(--text-sm);
  font-weight: 700; cursor: pointer; border: none; transition: all var(--duration-base);
  font-family: 'Plus Jakarta Sans', sans-serif; justify-content: center;
  background: ${({ $primary, $danger, $muted }) =>
    $primary ? "var(--aurora-gradient)" :
    $danger  ? "rgba(239,68,68,0.1)" :
    $muted   ? "var(--bg-overlay)" :
    "var(--bg-overlay)"};
  color: ${({ $primary, $danger, $muted }) =>
    $primary ? "white" :
    $danger  ? "var(--color-danger)" :
    $muted   ? "var(--text-tertiary)" :
    "var(--text-primary)"};
  box-shadow: ${({ $primary }) => $primary ? "0 4px 16px rgba(124,58,237,0.3)" : "none"};
  border: 1px solid ${({ $danger }) => $danger ? "rgba(239,68,68,0.2)" : "var(--border-subtle)"};
  &:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  svg { font-size: 0.85rem; }
`;
