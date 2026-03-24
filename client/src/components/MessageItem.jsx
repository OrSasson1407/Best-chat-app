import React, { useMemo, useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion"; 
import styled, { keyframes, css } from "styled-components";
import { 
    FaReply, FaSmile, FaTrash, FaPen, FaShare, FaStar, 
    FaClock, FaCheckDouble, FaFire, FaFileDownload, FaPoll, 
    FaRegClock, FaLanguage, FaSpinner, FaInfoCircle
} from "react-icons/fa";
import { getSmallAvatar, formatTime, isNewDay, formatDateBadge, isSameSender, isWithinTimeFrame } from "./chatHelpers";

import axios from "axios";
import { translateMessageRoute } from "../utils/APIRoutes";
import { toast } from "react-toastify";

// --- ZUSTAND STORE ---
import useChatStore from "../store/chatStore";

// --- Holographic Glitch Animation ---
const glitch = keyframes`
  0% { clip: rect(44px, 450px, 56px, 0); transform: skew(0.5deg); }
  5% { clip: rect(62px, 450px, 100px, 0); transform: skew(0.5deg); }
  10% { clip: rect(20px, 450px, 40px, 0); transform: skew(0.8deg); }
  15% { clip: rect(0, 0, 0, 0); }
  100% { clip: rect(0, 0, 0, 0); }
`;

// --- Styled Motion Div for the Bubble ---
const MessageBubble = styled(motion.div)`
  ${({ $themeType }) => $themeType === 'cyberpunk' && css`
    position: relative;
    
    &::before, &::after {
      content: attr(data-text);
      position: absolute; 
      top: 0; left: 0; width: 100%; height: 100%;
      background: transparent; 
      clip: rect(0, 0, 0, 0);
      pointer-events: none;
      padding: inherit;
      color: inherit;
    }
    
    /* Reveal glitch on hover in Cyberpunk mode */
    &:hover::before {
      left: 2px; text-shadow: -2px 0 #ff0055;
      animation: ${glitch} 2s infinite linear alternate-reverse;
    }
    &:hover::after {
      left: -2px; text-shadow: 2px 0 #00ff88;
      animation: ${glitch} 3s infinite linear alternate-reverse;
    }
  `}
`;

const HighlightedText = React.memo(({ text, query }) => {
    if (!query) return <span>{text}</span>;
    
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ?
                    <mark key={i} className="search-highlight">{part}</mark> : part
            )}
        </span>
    );
});

const MessageItem = React.memo(({
    message, prevMsg, nextMsg, currentChat, currentUser, searchQuery, highlightedMsgId,
    setLightboxImage, setReadReceiptsMsg, scrollToMessage, setReplyingTo,
    setEditingMessage, handleDeleteMsg, handleReaction, handleOpenViewOnce
}) => {
    
    // 🚀 PERFORMANCE FIX: Atomic Selector prevents unnecessary re-renders of the entire message list
    const theme = useChatStore((state) => state.theme);
    
    const [translatedText, setTranslatedText] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    
    // 🚀 REACT 19 UPGRADE: useTransition for async UI updates instead of manual loading states
    const [isTranslating, startTransition] = useTransition();

    const showDateSeparator = isNewDay(message.createdAt, prevMsg?.createdAt);
    const isGroupedWithPrev = prevMsg && isSameSender(message, prevMsg) &&
        isWithinTimeFrame(message, prevMsg) && !showDateSeparator;
    const isGroupedWithNext = nextMsg && isSameSender(message, nextMsg) &&
        isWithinTimeFrame(message, nextMsg) && !isNewDay(nextMsg.createdAt, message.createdAt);
    const isGroup = !!currentChat.admin;

    const groupedReactions = useMemo(() => {
        if (!message.reactions || message.reactions.length === 0) return [];
        const grouped = message.reactions.reduce((acc, r) => {
            acc[r.emoji] = acc[r.emoji] || { count: 0, users: [] };
            acc[r.emoji].count += 1;
            acc[r.emoji].users.push(r.username);
            return acc;
        }, {});
        return Object.entries(grouped);
    }, [message.reactions]);

    // 🚀 REACT 19 UPGRADE: Async Transition
    const handleTranslate = () => {
        if (translatedText) {
            setTranslatedText(null);
            return;
        }

        startTransition(async () => {
            try {
                // ✅ FIX: App.js interceptor handles Authorization header automatically
                const { data } = await axios.post(translateMessageRoute, {
                    message: message.message,
                    targetLanguage: "English" 
                });

                if (data.status) {
                    setTranslatedText(data.translatedText);
                } else {
                    console.warn("[AI] Translation API returned a false status.");
                    toast.error("Could not translate message.");
                }
            } catch (error) {
                console.error("[AI] Translation Error:", error);
                toast.error("Translation failed. Please try again.");
            }
        });
    };

    // --- NEW: Context Menu Handlers ---
    const handleContextMenu = (e) => {
        e.preventDefault();
        // Calculate position slightly offset from cursor
        setContextMenu({ x: e.pageX, y: e.pageY });
    };

    const closeContextMenu = () => setContextMenu(null);

    // 🔧 UX FIX: Close context menu when clicking anywhere else on the screen
    useEffect(() => {
        if (!contextMenu) return;
        const handleGlobalClick = () => closeContextMenu();
        window.addEventListener("click", handleGlobalClick);
        return () => window.removeEventListener("click", handleGlobalClick);
    }, [contextMenu]);

    // --- NEW: Animated Read Receipt SVG ---
    const renderAnimatedTicks = (status, hasReaders) => {
        const isRead = status === "read" || hasReaders;
        // Keep original WhatsApp blue for read, dim for delivered
        const color = isRead ? "#34B7F1" : "var(--text-dim)"; 
        return (
            <AnimatedTicks viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <motion.polyline points="20 6 9 17 4 12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
                {(status === "delivered" || isRead) && (
                    <motion.polyline points="20 12 14 18" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.2 }} />
                )}
            </AnimatedTicks>
        );
    };

    const renderStatusTicks = (msg) => {
        const handleClick = () => { if (isGroup) setReadReceiptsMsg(msg); };
        const hasReaders = isGroup && msg.readBy && msg.readBy.length > 0;

        return (
            <span className={`read-status-wrapper ${hasReaders ? 'has-avatars' : ''}`} onClick={handleClick} title={isGroup ? "View read receipts" : ""}>
                {hasReaders && (
                    <div className="reader-avatars">
                        {msg.readBy.slice(0, 3).map((reader, idx) => (
                            <img key={idx} src={getSmallAvatar(reader.username)} alt={reader.username} className="tiny-avatar" style={{ zIndex: 3 - idx }} />
                        ))}
                        {msg.readBy.length > 3 && <span className="more-readers">+{msg.readBy.length - 3}</span>}
                    </div>
                )}
                {msg.status === "pending" ? (
                    <span className="tick-pending" style={{ color: 'var(--text-dim)', opacity: 0.7 }}><FaRegClock size={11} /></span>
                ) : (
                    <span style={{ cursor: isGroup ? 'pointer' : 'default' }}>
                        {renderAnimatedTicks(msg.status, hasReaders)}
                    </span>
                )}
            </span>
        );
    };

    const renderMessageContent = (msg) => {
        if (msg.isDeleted) return <p className="deleted-text">{msg.message}</p>;
        if (msg.isViewOnce && !msg.fromSelf && !msg.viewed) return <button className="view-once-btn" onClick={() => handleOpenViewOnce(msg.id)}><FaFire /> View Once Media</button>;
        if (msg.isViewOnce && (msg.viewed || msg.message === "💣 Media Expired")) return <p className="deleted-text">💣 Media Expired</p>;

        const renderProcessingOverlay = () => {
            if (msg.status === "processing") {
                return (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
                        alignItems: 'center', zIndex: 10, borderRadius: 'inherit'
                    }}>
                        <FaSpinner className="fa-spin" color="#fff" size={24} style={{ animation: 'fa-spin 1s infinite linear' }} />
                    </div>
                );
            }
            return null;
        };

        if (msg.type === "text") {
            return (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <p>
                        <HighlightedText text={translatedText || msg.message} query={searchQuery} />
                    </p>
                    {isTranslating && <span style={{ fontSize: '0.65rem', color: 'var(--adaptive-accent)', fontStyle: 'italic', marginTop: '4px' }}>Translating via AI...</span>}
                    {translatedText && <span style={{ fontSize: '0.65rem', color: 'var(--text-main)', opacity: 0.7, fontStyle: 'italic', marginTop: '4px' }}>Translated from original</span>}
                </div>
            );
        }

        if (msg.type === "link" && msg.linkMetadata) {
            return (
                <div className="link-preview">
                    <p><HighlightedText text={msg.message} query={searchQuery} /></p>
                    <a href={msg.linkMetadata.url} target="_blank" rel="noreferrer" className="preview-card">
                        {msg.linkMetadata.image && <img src={msg.linkMetadata.image} alt="preview" />}
                        <div className="preview-info">
                            <h4>{msg.linkMetadata.title}</h4>
                            <p>{msg.linkMetadata.description}</p>
                        </div>
                    </a>
                </div>
            );
        }

        if (msg.type === "poll" && msg.pollData) {
            const totalVotes = msg.pollData.options.reduce((acc, opt) => acc + opt.votes.length, 0);
            return (
                <div className="poll-container">
                    <h4><FaPoll /> {msg.pollData.question}</h4>
                    {msg.pollData.options.map(opt => {
                        const percent = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                        const hasVoted = opt.votes.includes(currentUser._id);
                        return (
                            <div key={opt._id} className={`poll-option ${hasVoted ? 'voted' : ''}`}>
                                <div className="poll-bar" style={{ width: `${percent}%` }}></div>
                                <span className="opt-text">{opt.text}</span>
                                <span className="opt-percent">{percent}%</span>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (msg.type === "image") {
            return (
                // --- APPLIED Peek-to-Hover Container ---
                <MediaContainer style={{ position: 'relative' }}>
                    {renderProcessingOverlay()}
                    <img 
                        src={msg.message} 
                        alt="sent" 
                        className={`msg-image peek-media ${msg.status !== 'processing' ? 'clickable' : ''}`} 
                        onClick={() => msg.status !== 'processing' && setLightboxImage(msg.message)} 
                        style={{ opacity: msg.status === 'processing' ? 0.6 : 1 }} 
                    />
                </MediaContainer>
            );
        }

        if (msg.type === "video") {
            return (
                <div style={{ position: 'relative' }}>
                    {renderProcessingOverlay()}
                    <video 
                        controls={msg.status !== 'processing'} 
                        className="msg-video" 
                        style={{ opacity: msg.status === 'processing' ? 0.6 : 1 }}
                    >
                        <source src={msg.message} />
                        Your browser does not support video playback.
                    </video>
                </div>
            );
        }

        if (msg.type === "file") {
            const fName = msg.fileMetadata?.fileName || "Attachment";
            const fSize = msg.fileMetadata?.fileSize || "";
            return (
                <a href={msg.status === 'processing' ? '#' : msg.message} target={msg.status === 'processing' ? '_self' : '_blank'} rel="noreferrer" className="msg-file-link" style={{ opacity: msg.status === 'processing' ? 0.6 : 1, position: 'relative' }}>
                    {renderProcessingOverlay()}
                    <div className="file-icon"><FaFileDownload /></div>
                    <div className="file-details">
                        <span className="fname">{fName}</span>
                        {fSize && <span className="fsize">{fSize}</span>}
                    </div>
                </a>
            );
        }

        if (msg.type === "audio") {
            return (
                <div className="audio-player-wrapper" style={{ position: 'relative' }}>
                    {renderProcessingOverlay()}
                    <audio 
                        controls={msg.status !== 'processing'} 
                        src={msg.message} 
                        className="msg-audio" 
                        style={{ opacity: msg.status === 'processing' ? 0.6 : 1 }} 
                    />
                </div>
            );
        }

        if (msg.type === "code") return (<pre className="code-snippet"><code>{msg.message}</code></pre>);
        return <p>{msg.message}</p>;
    };

    const messageVariants = {
        hidden: { 
            opacity: 0, 
            x: message.fromSelf ? 50 : -50, 
            y: 10,
            scale: 0.95
        },
        visible: { 
            opacity: 1, 
            x: 0, 
            y: 0, 
            scale: 1,
            transition: { 
                type: "spring", 
                stiffness: 400, 
                damping: 30, 
                mass: 1 
            } 
        }
    };

    return (
        <div key={message.id} style={{ position: 'relative' }} onClick={closeContextMenu}>
            {showDateSeparator && (
                <div className="date-separator">
                    <span>{formatDateBadge(message.createdAt)}</span>
                </div>
            )}

            {/* --- NEW: Custom Context Menu Overlay --- */}
            <AnimatePresence>
                {contextMenu && (
                    <ContextMenu 
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div onClick={() => { setReplyingTo({ id: message.id, text: message.message, type: message.type, isSelfQuote: message.fromSelf }); closeContextMenu(); }}><FaReply /> Reply</div>
                        <div onClick={closeContextMenu}><FaShare /> Forward</div>
                        <div onClick={closeContextMenu}><FaStar /> Star</div>
                        
                        {message.type === "text" && (
                            <div onClick={() => { handleTranslate(); closeContextMenu(); }}>
                                {isTranslating ? <FaSpinner className="fa-spin" /> : <FaLanguage />} {translatedText ? "Show Original" : "Translate (AI)"}
                            </div>
                        )}
                        
                        {message.fromSelf && message.type === "text" && (
                            <div onClick={() => { setEditingMessage({ id: message.id, text: message.message }); closeContextMenu(); }}><FaPen /> Edit</div>
                        )}
                        <div className="danger" onClick={() => { handleDeleteMsg(message.id, message.fromSelf); closeContextMenu(); }}><FaTrash /> Delete</div>
                    </ContextMenu>
                )}
            </AnimatePresence>

            <div
                id={`msg-${message.id}`}
                className={`message-wrapper ${highlightedMsgId === message.id ? 'highlight-flash' : ''} ${isGroupedWithNext ? 'grouped-next' : ''} ${isGroupedWithPrev ? 'grouped-prev' : ''}`}
                onContextMenu={handleContextMenu}
            >
                {/* --- APPLIED STYLED MOTION COMPONENT --- */}
                <MessageBubble 
                    $themeType={theme}
                    data-text={message.type === 'text' ? message.message : ""}
                    className={`message ${message.fromSelf ? "sended" : "recieved"} ${message.isDeleted ? "deleted-msg" : ""}`}
                    initial="hidden"
                    animate="visible"
                    variants={messageVariants}
                    layout="position" 
                >
                    <div className="content tail-physics">
                        {message.isForwarded && <div className="forwarded-tag"><FaShare /> Forwarded</div>}

                        {message.replyTo && typeof message.replyTo === 'object' && (
                            <div className="quoted-message" onClick={() => scrollToMessage(message.replyTo.id)}>
                                <span>{message.replyTo.isSelfQuote ? "You" : "Them"}: </span>
                                {["text", "code"].includes(message.replyTo.type)
                                    ? (message.replyTo.text || "Message").substring(0, 40)
                                    : `[${(message.replyTo.type || "media").toUpperCase()}]`
                                }
                            </div>
                        )}

                        {!message.fromSelf && currentChat.admin && !isGroupedWithPrev && (
                            <span className="sender-name">{message.username}</span>
                        )}

                        <div className="message-payload">
                            {renderMessageContent(message)}
                        </div>

                        <div className="meta">
                            {message.timer && <FaClock className="timer-icon" title="Self-destructing message" />}
                            <span>{formatTime(message.createdAt)}</span>
                            {message.isStarred && <FaStar className="starred-icon" color="gold" size={10} />}
                            {message.isEdited && <span className="edited-tag">(edited)</span>}

                            {message.fromSelf && !message.isDeleted && (
                                <div className="read-status">
                                    {renderStatusTicks(message)}
                                </div>
                            )}
                        </div>
                        
                        {!message.isDeleted && (
                            <div className="message-actions">
                                <button onClick={() => setReplyingTo({ id: message.id, text: message.message, type: message.type, isSelfQuote: message.fromSelf })} title="Reply"><FaReply /></button>
                                
                                {message.type === "text" && (
                                    <button onClick={handleTranslate} title={translatedText ? "Show Original" : "Translate with AI"}>
                                        {isTranslating ? <FaSpinner className="fa-spin" /> : <FaLanguage color={translatedText ? "var(--msg-sent)" : "inherit"} />}
                                    </button>
                                )}

                                <button title="Forward"><FaShare /></button>
                                <button title="Star"><FaStar /></button>
                                <div className="reaction-trigger">
                                    <FaSmile title="React" />
                                    <div className="reaction-menu">
                                        {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                                            <span key={emoji} onClick={() => handleReaction(message.id, emoji)} className="reaction-emoji-btn">{emoji}</span>
                                        ))}
                                    </div>
                                </div>
                                {message.fromSelf && message.type === "text" && (
                                    <button onClick={() => setEditingMessage({ id: message.id, text: message.message })} title="Edit"><FaPen size={12} /></button>
                                )}
                                <button onClick={() => handleDeleteMsg(message.id, message.fromSelf)} title="Delete"><FaTrash size={12} /></button>
                            </div>
                        )}

                        {groupedReactions.length > 0 && !message.isDeleted && (
                            <div className="reactions-display">
                                {groupedReactions.map(([emoji, data]) => (
                                    <div
                                        key={emoji}
                                        className="reaction-pill"
                                        title={data.users.join(', ')}
                                    >
                                        <span className="reaction-anim">{emoji}</span>
                                        {data.count > 1 && (
                                            <span className="reaction-count" style={{ marginLeft: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                {data.count}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </MessageBubble>
            </div>
        </div>
    );
});

// --- NEW STYLED COMPONENTS FOR UI UPGRADES ---

const AnimatedTicks = styled.svg`
    width: 14px; height: 14px; margin-left: 4px; display: inline-block; vertical-align: middle;
`;

const ContextMenu = styled(motion.div)`
    position: fixed; background: var(--bg-panel); backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border); border-radius: 12px; padding: 6px 0; width: 180px;
    box-shadow: 0 15px 40px rgba(0,0,0,0.2); z-index: 1000; overflow: hidden;
    div { 
        padding: 10px 16px; display: flex; align-items: center; gap: 12px; font-size: 0.85rem; 
        color: var(--text-main); cursor: pointer; transition: 0.2s; font-weight: 500;
        &:hover { background: var(--input-bg); transform: translateX(2px); } 
        &.danger { color: #ff4e4e; &:hover { background: rgba(255, 78, 78, 0.15); } } 
    }
`;

const MediaContainer = styled.div`
    position: relative; border-radius: 8px; overflow: visible; 
    .peek-media { 
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease; 
        transform-origin: center center; z-index: 1; position: relative;
        &:hover { 
            transform: scale(1.4); 
            z-index: 100; 
            box-shadow: 0 20px 50px rgba(0,0,0,0.6); 
            border: 2px solid var(--msg-sent); 
        } 
    }
`;

export default MessageItem;