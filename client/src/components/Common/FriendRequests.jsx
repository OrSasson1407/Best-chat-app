import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "react-toastify";
import { FaCheck, FaTimes, FaUserFriends, FaUserAstronaut } from "react-icons/fa";

import useChatStore from "../../store/chatStore";
import { host } from "../../utils/APIRoutes";

export default function FriendRequests({ onClose, onAccepted }) {
    const { currentUser, updateCurrentUser, theme } = useChatStore();
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loadingId, setLoadingId] = useState(null);

    // Extract pending requests from currentUser
    useEffect(() => {
        if (currentUser && currentUser.friendRequests) {
            const pending = currentUser.friendRequests.filter(req => req.status === "pending");
            setPendingRequests(pending);
        } else {
            setPendingRequests([]);
        }
    }, [currentUser]);

    const getAuthHeader = () => {
        const rawToken = currentUser?.token || sessionStorage.getItem("chat-app-token") || "";
        const cleanToken = rawToken.replace(/(Bearer\s*)+/gi, "").trim();
        return { headers: { Authorization: `Bearer ${cleanToken}` } };
    };

    const handleAction = async (requestId, action) => {
        setLoadingId(requestId);
        try {
            // Adjust this URL to match your exact backend route for accept/reject
            const { data } = await axios.post(
                `${host}/api/auth/friend-request/${action}`, 
                { requestId, userId: currentUser._id }, 
                getAuthHeader()
            );

            if (data.status) {
                toast.success(`Request ${action}ed successfully.`);
                
                // If the backend returns the updated user object, sync it with Zustand
                if (data.user) {
                    const currentToken = sessionStorage.getItem("chat-app-token");
                    const updatedUser = { ...data.user, token: currentToken };
                    sessionStorage.setItem("chat-app-user", JSON.stringify(updatedUser));
                    updateCurrentUser(updatedUser);
                }

                if (action === "accept" && onAccepted) onAccepted();
                
                // Auto-close if no more requests
                if (pendingRequests.length <= 1) {
                    onClose();
                }
            } else {
                toast.error(data.msg || `Failed to ${action} request.`);
            }
        } catch (error) {
            console.error(`[FriendRequests] Error during ${action}:`, error);
            toast.error("An error occurred. Please try again.");
        } finally {
            setLoadingId(null);
        }
    };

    const getAvatarUrl = (user) => {
        if (user?.avatarImage) {
            if (!user.avatarImage.startsWith("http") && !user.avatarImage.startsWith("data:")) {
                return `https://avatar.iran.liara.run/public/${user.avatarImage}`;
            }
            return user.avatarImage;
        }
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.username || "default"}`;
    };

    return (
        <Overlay 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
        >
            <Container 
                $theme={theme}
                initial={{ scale: 0.9, y: -20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: -20, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <div className="header">
                    <h3><FaUserFriends /> Friend Requests</h3>
                    <button className="close-btn" onClick={onClose}><FaTimes /></button>
                </div>

                <div className="request-list">
                    {pendingRequests.length === 0 ? (
                        <div className="empty-state">
                            <FaUserAstronaut className="empty-icon" />
                            <p>No pending friend requests.</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {pendingRequests.map((req) => {
                                // Assuming req.sender contains the user details. Adjust if your DB schema is different.
                                const sender = req.sender || req.fromUser; 
                                if (!sender) return null;

                                return (
                                    <motion.div 
                                        key={req._id} 
                                        className="request-item"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                    >
                                        <div className="user-info">
                                            <img src={getAvatarUrl(sender)} alt="avatar" />
                                            <div>
                                                <h4>{sender.username}</h4>
                                                <p>wants to be your friend</p>
                                            </div>
                                        </div>
                                        <div className="actions">
                                            <button 
                                                className="accept-btn" 
                                                onClick={() => handleAction(req._id, "accept")}
                                                disabled={loadingId === req._id}
                                            >
                                                {loadingId === req._id ? "..." : <FaCheck />}
                                            </button>
                                            <button 
                                                className="reject-btn" 
                                                onClick={() => handleAction(req._id, "reject")}
                                                disabled={loadingId === req._id}
                                            >
                                                {loadingId === req._id ? "..." : <FaTimes />}
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>
            </Container>
        </Overlay>
    );
}

/* ── STYLED COMPONENTS ───────────────────────────────────────────────────────*/

const Overlay = styled(motion.div)`
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    z-index: 999;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding: 80px 30px;
    
    @media (max-width: 768px) {
        justify-content: center;
        padding: 80px 15px;
    }
`;

const Container = styled(motion.div)`
    width: 350px;
    max-height: 400px;
    background: var(--input-bg);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(16px);
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.2rem;
        border-bottom: 1px solid var(--glass-border);
        background: rgba(255, 255, 255, 0.02);

        h3 {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 1rem;
            color: var(--text-primary);
            margin: 0;
            font-weight: 700;
        }

        .close-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 1.1rem;
            transition: color 0.2s;
            &:hover { color: #ff5c72; }
        }
    }

    .request-list {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        overflow-y: auto;
        
        &::-webkit-scrollbar { width: 4px; }
        &::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem 0;
        color: var(--text-secondary);
        
        .empty-icon {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            opacity: 0.5;
        }
        p { font-size: 0.9rem; }
    }

    .request-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--bg-surface);
        padding: 0.8rem;
        border-radius: 12px;
        border: 1px solid var(--glass-border);

        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;

            img {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid var(--msg-sent);
            }

            h4 {
                font-size: 0.95rem;
                color: var(--text-primary);
                margin: 0;
            }

            p {
                font-size: 0.75rem;
                color: var(--text-secondary);
                margin: 2px 0 0;
            }
        }

        .actions {
            display: flex;
            gap: 8px;

            button {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                cursor: pointer;
                transition: transform 0.2s, filter 0.2s;

                &:hover:not(:disabled) {
                    transform: scale(1.1);
                    filter: brightness(1.2);
                }
                &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            }

            .accept-btn {
                background: #10b981; // Emerald green
                color: white;
            }

            .reject-btn {
                background: #ef4444; // Rose red
                color: white;
            }
        }
    }
`;