// client/src/components/FriendRequests.jsx — Sprint 2: Friend Request Panel
import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import axios from "axios";
import { toast } from "react-toastify";
import { FaTimes, FaCheck, FaUserPlus, FaUserFriends } from "react-icons/fa";
import { getFriendRequestsRoute, respondFriendRequestRoute } from "../utils/APIRoutes";
import useChatStore from "../store/chatStore";

export default function FriendRequests({ onClose, onAccepted }) {
  const { currentUser, setPendingRequestCount } = useChatStore();
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [responding, setResponding] = useState(null); // fromId of in-flight response

  const token   = currentUser?.token || sessionStorage.getItem("chat-app-token");
  const headers = { Authorization: `Bearer ${token}` };

  // ── Fetch pending requests ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    axios
      .get(getFriendRequestsRoute, { headers })
      .then(({ data }) => {
        if (data.status) {
          setRequests(data.requests || []);
          setPendingRequestCount(data.requests?.length || 0);
        }
      })
      .catch(() => toast.error("Failed to load requests."))
      .finally(() => setLoading(false));
  }, []);

  // ── Respond to a request ───────────────────────────────────────────────────
  const handleRespond = async (fromId, action) => {
    setResponding(fromId);
    try {
      const { data } = await axios.post(respondFriendRequestRoute, { fromId, action }, { headers });
      if (data.status) {
        toast.success(action === "accept" ? "Contact added!" : "Request declined.");
        const remaining = requests.filter((r) => String(r.from._id) !== String(fromId));
        setRequests(remaining);
        setPendingRequestCount(remaining.length);
        if (action === "accept" && onAccepted) onAccepted(fromId);
      } else {
        toast.error(data.msg || "Something went wrong.");
      }
    } catch { toast.error("Failed to respond."); }
    finally { setResponding(null); }
  };

  return (
    <Panel>
      <PanelHeader>
        <FaUserFriends />
        <span>Contact requests</span>
        {requests.length > 0 && <Badge>{requests.length}</Badge>}
        <FaTimes className="close" onClick={onClose} />
      </PanelHeader>

      {loading ? (
        <Empty><div className="spinner" /><p>Loading…</p></Empty>
      ) : requests.length === 0 ? (
        <Empty>
          <FaUserPlus className="empty-icon" />
          <p>No pending requests</p>
          <small>When someone sends you a contact request, it'll appear here.</small>
        </Empty>
      ) : (
        <List>
          {requests.map((req) => (
            <RequestRow key={req.from._id}>
              <img
                src={req.from.avatarImage || `https://api.dicebear.com/9.x/avataaars/svg?seed=${req.from.username}`}
                alt={req.from.username}
                className="avatar"
              />
              <div className="info">
                <p className="name">{req.from.username}</p>
                <p className="sub">{req.from.statusMessage || "Wants to connect"}</p>
              </div>
              <div className="actions">
                <AcceptBtn
                  onClick={() => handleRespond(req.from._id, "accept")}
                  disabled={responding === req.from._id}
                  title="Accept"
                >
                  <FaCheck />
                </AcceptBtn>
                <DeclineBtn
                  onClick={() => handleRespond(req.from._id, "decline")}
                  disabled={responding === req.from._id}
                  title="Decline"
                >
                  <FaTimes />
                </DeclineBtn>
              </div>
            </RequestRow>
          ))}
        </List>
      )}
    </Panel>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const slideIn = keyframes`from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}`;

const Panel = styled.div`
  background: var(--bg-panel); border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl); width: min(360px, 95vw);
  box-shadow: 0 16px 48px rgba(0,0,0,0.35); overflow: hidden;
  animation: ${slideIn} 0.2s var(--ease-spring);
`;

const PanelHeader = styled.div`
  display: flex; align-items: center; gap: 10px;
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-subtle);
  font-weight: 700; font-size: var(--text-sm); color: var(--text-primary);
  svg:first-child { color: var(--msg-sent); font-size: 1rem; }
  .close {
    margin-left: auto; cursor: pointer; color: var(--text-secondary);
    transition: color var(--duration-fast); font-size: 1rem;
    &:hover { color: var(--color-danger); }
  }
`;

const Badge = styled.span`
  background: var(--msg-sent); color: white;
  font-size: 0.65rem; font-weight: 800;
  padding: 2px 7px; border-radius: var(--radius-full);
`;

const Empty = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 2.5rem 1.5rem; text-align: center;
  color: var(--text-secondary); font-size: var(--text-sm);
  .empty-icon { font-size: 2rem; color: var(--text-tertiary); }
  small { font-size: var(--text-xs); color: var(--text-tertiary); }
  .spinner {
    width: 24px; height: 24px; border: 3px solid var(--border-subtle);
    border-top-color: var(--msg-sent); border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const List = styled.div`
  max-height: 400px; overflow-y: auto;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }
`;

const RequestRow = styled.div`
  display: flex; align-items: center; gap: 12px;
  padding: 12px 1.25rem; border-bottom: 1px solid var(--border-subtle);
  &:last-child { border-bottom: none; }

  .avatar {
    width: 44px; height: 44px; border-radius: 50%; object-fit: cover;
    border: 2px solid var(--border-subtle); flex-shrink: 0;
  }
  .info { flex: 1; overflow: hidden; }
  .name { font-weight: 700; font-size: var(--text-sm); color: var(--text-primary); margin: 0 0 2px; }
  .sub  { font-size: var(--text-xs); color: var(--text-secondary); margin: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .actions { display: flex; gap: 6px; flex-shrink: 0; }
`;

const iconBtn = `
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; border: none; font-size: 0.75rem;
  transition: all var(--duration-base);
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const AcceptBtn = styled.button`
  ${iconBtn}
  background: rgba(34,211,165,0.12); color: var(--color-success);
  border: 1px solid rgba(34,211,165,0.25);
  &:hover:not(:disabled) { background: rgba(34,211,165,0.25); transform: scale(1.05); }
`;

const DeclineBtn = styled.button`
  ${iconBtn}
  background: rgba(239,68,68,0.08); color: var(--color-danger);
  border: 1px solid rgba(239,68,68,0.2);
  &:hover:not(:disabled) { background: rgba(239,68,68,0.18); transform: scale(1.05); }
`;
