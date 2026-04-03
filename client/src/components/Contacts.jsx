import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaUserFriends, FaPlus, FaSearch, FaCog, FaThumbtack,
    FaRegEnvelope, FaTimes, FaSpinner, FaShieldAlt, FaEye, FaGlobe,
    FaSun, FaMoon, FaSignOutAlt, FaCheck, FaChevronLeft, FaChevronRight
} from "react-icons/fa";
import { BsChatDotsFill, BsPeopleFill } from "react-icons/bs";
import { MdOutlineAllInclusive } from "react-icons/md";
import axios from "axios";
import {
    host, createGroupRoute, getUserGroupsRoute, updateProfileRoute,
    searchMessageRoute, getStoryFeedRoute, addStoryRoute, viewStoryRoute,
    searchChannelsRoute, joinChannelRoute, publicKeyRoute
} from "../utils/APIRoutes";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import useChatStore from "../store/chatStore";
import { generateGroupAESKey, encryptMessage } from "../utils/crypto";

const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

const formatLastSeen = (dateString) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function Contacts({ contacts, changeChat, handleLogout }) {
    const {
        currentUser, updateCurrentUser, onlineUsers, theme, setTheme,
        isCompact, setIsCompact, globalTypingUsers
    } = useChatStore();

    const [currentUserName, setCurrentUserName] = useState(currentUser?.username);
    const [currentSelected, setCurrentSelected] = useState(undefined);
    const [activeFolder, setActiveFolder] = useState("all");
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const [pinnedIds, setPinnedIds] = useState(() => {
        try {
            const saved = localStorage.getItem(`pinned-chats-${currentUser?._id}`);
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });

    const [groups, setGroups] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const [globalMessages, setGlobalMessages] = useState([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

    // Modals
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showDiscoverModal, setShowDiscoverModal] = useState(false);

    // Channels
    const [channelSearchQuery, setChannelSearchQuery] = useState("");
    const [discoveredChannels, setDiscoveredChannels] = useState([]);
    const [isSearchingChannels, setIsSearchingChannels] = useState(false);

    // User Profile
    const [profileData, setProfileData] = useState({
        statusIcon: "✨", statusMessage: "Available", bio: "", interests: "",
        privacySettings: { lastSeen: "everyone", readReceipts: true, profilePhoto: "everyone" }
    });
    const [hasPin, setHasPin] = useState(!!localStorage.getItem("app-pin-code"));

    // Stories
    const [storyFeed, setStoryFeed] = useState([]);
    const [viewingStoryUser, setViewingStoryUser] = useState(null);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [isUploadingStory, setIsUploadingStory] = useState(false);
    const fileInputRef = useRef(null);

    const pressTimer = useRef(null);
    const [storyPreview, setStoryPreview] = useState(null);

    // Initialize Data
    useEffect(() => {
        const fetchGroupsAndStories = async () => {
            if (currentUser) {
                try {
                    const [groupRes, storyRes] = await Promise.all([
                        axios.get(getUserGroupsRoute),
                        axios.get(getStoryFeedRoute)
                    ]);
                    setGroups(groupRes.data || []);
                    if (storyRes.data.status) setStoryFeed(storyRes.data.feed || []);
                } catch (error) {
                    console.error("[API] Error fetching contacts data:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        if (currentUser) {
            setCurrentUserName(currentUser.username);
            setProfileData({
                statusIcon: currentUser.statusIcon || "✨",
                statusMessage: currentUser.statusMessage || "Available",
                bio: currentUser.bio || "",
                interests: currentUser.interests ? currentUser.interests.join(", ") : "",
                privacySettings: currentUser.privacySettings || { lastSeen: "everyone", readReceipts: true, profilePhoto: "everyone" }
            });
            fetchGroupsAndStories();
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) localStorage.setItem(`pinned-chats-${currentUser._id}`, JSON.stringify(pinnedIds));
    }, [pinnedIds, currentUser]);

    useEffect(() => {
        let timer;
        if (viewingStoryUser && viewingStoryUser.stories) {
            timer = setTimeout(() => handleNextStory(), 5000);
        }
        return () => clearTimeout(timer);
    }, [viewingStoryUser, currentStoryIndex]);

    // Debounced Message Search
    useEffect(() => {
        if (!searchTerm || searchTerm.length < 3) {
            setGlobalMessages([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingGlobal(true);
            try {
                const { data } = await axios.post(searchMessageRoute, {
                    userId: currentUser._id,
                    query: searchTerm
                });
                if (data.status) setGlobalMessages(data.messages || []);
            } catch (error) {
                console.error("[API] Error searching messages:", error);
            } finally {
                setIsSearchingGlobal(false);
            }
        }, 600);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, currentUser]);

    // Debounced Channel Search
    useEffect(() => {
        if (!channelSearchQuery) {
            setDiscoveredChannels([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingChannels(true);
            try {
                const { data } = await axios.get(`${searchChannelsRoute}?query=${channelSearchQuery}`);
                if (data.status) setDiscoveredChannels(data.channels || []);
            } catch (error) {
                console.error("[API] Error searching channels:", error);
            } finally {
                setIsSearchingChannels(false);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [channelSearchQuery, currentUser]);

    // Handlers
    const togglePin = useCallback((e, id) => {
        e.stopPropagation();
        setPinnedIds((prev) => {
            const currentPins = prev || [];
            if (currentPins.includes(id)) {
                toast.info("Chat unpinned.");
                return currentPins.filter(pid => pid !== id);
            } else {
                if (currentPins.length >= 5) {
                    toast.warning("You can only pin up to 5 chats.");
                    return currentPins;
                }
                toast.success("Chat pinned.");
                return [...currentPins, id];
            }
        });
    }, []);

    const changeCurrentChat = useCallback((contact, isGroup = false) => {
        setCurrentSelected(contact._id);
        changeChat(contact, isGroup);
    }, [changeChat]);

    const handleGlobalMessageClick = (msg) => {
        let targetChat = groups.find(g => msg.users?.includes(g._id));
        let isGroupChat = !!targetChat;

        if (!targetChat) {
            const otherUserId = msg.users?.find(id => id !== currentUser._id);
            targetChat = contacts.find(c => c._id === otherUserId);
        }

        if (targetChat) {
            changeCurrentChat(targetChat, isGroupChat);
            setSearchTerm("");
        } else {
            toast.error("Chat not found. It may have been deleted.");
        }
    };

    const handleStoryUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploadingStory(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            try {
                const { data } = await axios.post(addStoryRoute, {
                    mediaUrl: reader.result,
                    mediaType: file.type.startsWith("video") ? "video" : "image"
                });
                if (data.status) {
                    toast.success("Status updated.");
                    const storyRes = await axios.get(getStoryFeedRoute);
                    setStoryFeed(storyRes.data.feed || []);
                }
            } catch (err) {
                console.error("[Media] Failed to upload status:", err);
                toast.error("Status upload failed. Please try again.");
            } finally {
                setIsUploadingStory(false);
            }
        };
    };

    const openStoryViewer = async (userFeedObj) => {
        setViewingStoryUser(userFeedObj);
        setCurrentStoryIndex(0);
        const firstStory = userFeedObj?.stories?.[0];
        if (firstStory && firstStory.user?._id !== currentUser._id) {
            try {
                await axios.post(`${viewStoryRoute}/${firstStory._id}`, {});
            } catch (error) {
                console.error("[API] Failed to mark story as viewed", error);
            }
        }
    };

    const handleNextStory = async () => {
        if (!viewingStoryUser || !viewingStoryUser.stories) return;
        if (currentStoryIndex < viewingStoryUser.stories.length - 1) {
            const nextIdx = currentStoryIndex + 1;
            setCurrentStoryIndex(nextIdx);
            const nextStory = viewingStoryUser.stories[nextIdx];
            if (nextStory && nextStory.user?._id !== currentUser._id) {
                try {
                    await axios.post(`${viewStoryRoute}/${nextStory._id}`, {});
                } catch (error) {
                    console.error("[API] Failed to mark story as viewed", error);
                }
            }
        } else {
            setViewingStoryUser(null);
        }
    };

    const handleStoryPressStart = (feedItem) => {
        pressTimer.current = setTimeout(() => {
            setStoryPreview(feedItem);
        }, 400);
    };

    const handleStoryPressEnd = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        setStoryPreview(null);
    };

    const toggleMemberSelection = (id) => {
        setSelectedMembers(prev => prev?.includes(id) ? prev.filter(m => m !== id) : [...(prev || []), id]);
    };

    const handleCreateGroup = async () => {
        if (groupName.length < 3) return toast.error("Group name must be at least 3 characters.");
        if (selectedMembers.length < 1) return toast.error("Please select at least 1 member.");

        try {
            const allMembers = [...selectedMembers, currentUser._id];

            console.log(`[Crypto] Generating AES Group Key for ${allMembers.length} members...`);
            const aesKeyJwk = await generateGroupAESKey();
            const aesKeyString = JSON.stringify(aesKeyJwk);

            const keyPromises = allMembers.map(async (userId) => {
                try {
                    const pkResponse = await axios.get(`${publicKeyRoute}/${userId}`);
                    if (pkResponse.data.status && pkResponse.data.bundle) {
                        const userPublicKey = pkResponse.data.bundle.identityKey;
                        return { userId, encryptedKey: await encryptMessage(aesKeyString, userPublicKey) };
                    }
                } catch (err) {
                    console.warn(`[Crypto] Failed to fetch key for user ${userId}`);
                }
                return null;
            });

            const resolvedKeys = await Promise.all(keyPromises);
            const groupKeys = resolvedKeys.filter(k => k !== null);

            const { data } = await axios.post(createGroupRoute, {
                name: groupName,
                members: allMembers,
                admin: currentUser._id,
                groupKeys
            });

            if (data.status) {
                setGroups([...groups, data.group]);
                setShowGroupModal(false);
                setGroupName("");
                setSelectedMembers([]);
                toast.success("Group created successfully.");
            }
        } catch (error) {
            console.error("[API] Failed to create group", error);
            toast.error("Failed to create group. Please try again.");
        }
    };

    const handleJoinChannel = async (channelId) => {
        try {
            const { data } = await axios.post(joinChannelRoute, { channelId });
            if (data.status) {
                toast.success("Joined channel.");
                setShowDiscoverModal(false);
                setGroups(prev => [...prev, data.channel]);
            }
        } catch (error) {
            toast.error(error.response?.data?.msg || "Failed to join channel.");
        }
    };

    const handleUpdateProfile = async () => {
        try {
            const interestsArray = profileData.interests
                ? profileData.interests.split(",").map(i => i.trim()).filter(i => i !== "")
                : [];

            const { data } = await axios.post(`${updateProfileRoute}/${currentUser._id}`, {
                ...profileData,
                interests: interestsArray
            });

            if (data.status) {
                const currentToken = sessionStorage.getItem("chat-app-token");
                const updatedUser = { ...data.user, token: currentToken };
                sessionStorage.setItem("chat-app-user", JSON.stringify(updatedUser));
                updateCurrentUser(data.user); 
                toast.success("Profile updated.");
                setShowProfileModal(false);
            }
        } catch (error) {
            console.error("[API] Failed to update profile.", error);
            toast.error("Failed to update profile.");
        }
    };

    const getAvatarUrl = (user) => {
        if (user?.avatarImage) {
            if (!user.avatarImage.startsWith("http") && !user.avatarImage.startsWith("data:"))
                return `https://avatar.iran.liara.run/public/${user.avatarImage}`;
            return user.avatarImage;
        }
        const seed = user?.username || "default";
        const tops = user?.gender === "female" ? femaleTops : maleTops;
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&top=${tops}&backgroundColor=${backgroundColors}`;
    };

    const unreadPersonalChatsCount = (contacts || []).filter(c => c.unreadCount > 0).length;
    const unreadGroupsCount = (groups || []).filter(g => g.unreadCount > 0).length;
    const totalUnreadChatsCount = unreadPersonalChatsCount + unreadGroupsCount;

    const displayedItems = useMemo(() => {
        let all = [
            ...(contacts || []).map(c => ({ ...c, isGroup: false })),
            ...(groups || []).map(g => ({ ...g, isGroup: true, username: g.name }))
        ];

        if (searchTerm) all = all.filter(item => item.username?.toLowerCase()?.includes(searchTerm.toLowerCase()));
        if (activeFolder === "personal") all = all.filter(i => !i.isGroup);
        if (activeFolder === "groups") all = all.filter(i => i.isGroup);
        if (activeFolder === "unread") all = all.filter(i => i.unreadCount > 0);

        return all.sort((a, b) => {
            const aPinned = pinnedIds?.includes(a._id);
            const bPinned = pinnedIds?.includes(b._id);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;

            const aOnline = !a.isGroup && onlineUsers?.includes(a._id);
            const bOnline = !b.isGroup && onlineUsers?.includes(b._id);
            if (aOnline !== bOnline) return aOnline ? -1 : 1;

            return (a.username || "").localeCompare(b.username || "");
        });
    }, [contacts, groups, searchTerm, activeFolder, pinnedIds, onlineUsers]);

    const folders = [
        { id: "all", icon: <MdOutlineAllInclusive />, title: "All", badge: totalUnreadChatsCount },
        { id: "personal", icon: <BsChatDotsFill size={14} />, title: "Personal", badge: unreadPersonalChatsCount },
        { id: "groups", icon: <BsPeopleFill />, title: "Groups", badge: unreadGroupsCount },
        { id: "unread", icon: <FaRegEnvelope size={14} />, title: "Unread", badge: totalUnreadChatsCount, danger: true }
    ];

    return (
        <>
            {currentUser && (
                <Container $isCompact={isCompact} $themeType={theme}>

                    <div className="sidebar-dynamic-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        
                        {/* 1. BRAND & TOGGLE SECTION */}
                        <div className="brand-area" style={{ padding: isCompact ? "20px 0" : "24px", display: 'flex', justifyContent: isCompact ? 'center' : 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            {!isCompact && <motion.h3 style={{ color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '2px', margin: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>SNAPPY</motion.h3>}
                            <button 
                                className="sidebar-toggle-trigger" 
                                onClick={() => setIsCompact(!isCompact)}
                                style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-dim)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            >
                                {isCompact ? <FaChevronRight /> : <FaChevronLeft />}
                            </button>
                        </div>

                        {/* 2. STORIES / ACTIVITY RAIL */}
                        <AnimatePresence>
                            {storyPreview && (
                                <StoryPreviewTooltip
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <img src={storyPreview.stories?.[0]?.mediaUrl || getAvatarUrl(storyPreview.user)} alt="preview" />
                                    <div className="info">
                                        <h4>{storyPreview.user?.username}</h4>
                                        <p>{storyPreview.stories?.length} status update{storyPreview.stories?.length > 1 ? "s" : ""}</p>
                                    </div>
                                </StoryPreviewTooltip>
                            )}
                        </AnimatePresence>

                        {!isCompact && (
                            <StoryTray>
                                <motion.div className="story-item my-status" onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <div className="story-ring empty">
                                        <img src={getAvatarUrl(currentUser)} alt="my-status" />
                                        <div className="add-icon">{isUploadingStory ? <FaSpinner className="fa-spin" /> : <FaPlus />}</div>
                                    </div>
                                    <p>My Status</p>
                                    <input id="story-upload" name="story-upload" type="file" hidden ref={fileInputRef} accept="image/*,video/*" onChange={handleStoryUpload} />
                                </motion.div>

                                {(storyFeed || []).map((feedItem, index) => {
                                    const hasUnread = feedItem.stories?.some(s => !s.viewers?.some(v => v.userId === currentUser._id));
                                    return (
                                        <motion.div
                                            key={index}
                                            className="story-item"
                                            onClick={() => openStoryViewer(feedItem)}
                                            onMouseDown={() => handleStoryPressStart(feedItem)}
                                            onMouseUp={handleStoryPressEnd}
                                            onMouseLeave={handleStoryPressEnd}
                                            onTouchStart={() => handleStoryPressStart(feedItem)}
                                            onTouchEnd={handleStoryPressEnd}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <motion.div layoutId={`story-avatar-${feedItem.user?._id}`} className={`story-ring ${hasUnread ? "unread" : "read"}`}>
                                                <img src={getAvatarUrl(feedItem.user)} alt="status" />
                                            </motion.div>
                                            <p>{feedItem.user?.username}</p>
                                        </motion.div>
                                    );
                                })}
                            </StoryTray>
                        )}

                        {/* 3. NAVIGATION FOLDERS (Rail Adaptive) */}
                        <div className="nav-folders" style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: '4px', padding: isCompact ? '0 10px' : '0 16px', flexShrink: 0, marginBottom: '16px' }}>
                            {folders.map(f => (
                                <button 
                                    key={f.id} 
                                    className={`folder-item ${activeFolder === f.id ? 'active' : ''}`}
                                    onClick={() => setActiveFolder(f.id)}
                                    title={isCompact ? f.title : ""}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: isCompact ? 'center' : 'center',
                                        gap: '6px', padding: isCompact ? '12px 0' : '8px 0', background: activeFolder === f.id ? 'var(--input-bg)' : 'transparent',
                                        border: '1px solid', borderColor: activeFolder === f.id ? 'var(--glass-border)' : 'transparent',
                                        borderRadius: '12px', color: activeFolder === f.id ? 'var(--text-main)' : 'var(--text-dim)',
                                        cursor: 'pointer', position: 'relative'
                                    }}
                                >
                                    <div className="icon-wrap" style={{ position: 'relative', fontSize: '1.2rem', display: 'flex' }}>
                                        {f.icon}
                                        {f.badge > 0 && <span className="folder-badge" style={{ position: 'absolute', top: '-6px', right: '-8px', background: f.danger ? '#ff4e4e' : 'var(--msg-sent)', color: 'white', fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 5px', borderRadius: '10px', border: '2px solid var(--bg-panel)' }}>{f.badge}</span>}
                                    </div>
                                    {!isCompact && <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{f.title}</span>}
                                </button>
                            ))}
                        </div>

                        {/* 4. SEARCH (Hidden in Rail View) */}
                        {!isCompact && (
                            <div className={`search-container ${isSearchFocused ? "focused" : ""}`} style={{ flexShrink: 0, padding: '0 16px', marginBottom: '16px' }}>
                                <motion.div className="search-box" animate={{ borderColor: isSearchFocused ? "var(--msg-sent)" : "var(--glass-border)" }} style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', borderRadius: '16px', padding: '0 16px', border: '1px solid var(--glass-border)' }}>
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
                                            <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} className="icon clear-icon" onClick={() => setSearchTerm("")} style={{ cursor: 'pointer', color: 'var(--text-dim)' }}>
                                                <FaTimes />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </div>
                        )}

                        {/* 5. CONTACTS LIST */}
                        <div className="contacts-scroller" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {isLoading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="contact-item skeleton" style={{ display: 'flex', gap: '12px', padding: '12px' }}>
                                        <div className="avatar skeleton-anim" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                                        {!isCompact && (
                                            <div className="details" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                                                <div className="skeleton-line skeleton-anim" style={{ height: '12px', width: '60%', borderRadius: '6px' }} />
                                                <div className="skeleton-line short skeleton-anim" style={{ height: '12px', width: '40%', borderRadius: '6px' }} />
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <>
                                    {!isCompact && activeFolder === "groups" && !searchTerm && (
                                        <div className="group-actions" style={{ display: 'flex', gap: '8px', padding: '0 4px 8px' }}>
                                            <button className="primary" onClick={() => setShowGroupModal(true)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, var(--msg-sent), #9a41fe)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}><FaPlus /> Create</button>
                                            <button className="secondary" onClick={() => setShowDiscoverModal(true)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--input-bg)', color: 'var(--text-main)', fontWeight: 'bold', cursor: 'pointer' }}><FaGlobe /> Discover</button>
                                        </div>
                                    )}

                                    {!isCompact && searchTerm.length >= 3 && <div className="section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: '700', margin: '16px 8px 8px' }}>Chats & Groups</div>}

                                    {displayedItems.length === 0 && !searchTerm && !isCompact ? (
                                        <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px 0', fontStyle: 'italic' }}>No chats found.</div>
                                    ) : (
                                        displayedItems.map((item) => {
                                            const isOnline = !item.isGroup && onlineUsers?.includes(item._id);
                                            const isPinned = pinnedIds?.includes(item._id);
                                            const isTyping = !item.isGroup && globalTypingUsers?.includes(item._id);
                                            const isSelected = item._id === currentSelected;

                                            return (
                                                <ContactItem
                                                    key={item._id}
                                                    className={`${isSelected ? "selected" : ""} ${isPinned ? "pinned" : ""}`}
                                                    onClick={() => changeCurrentChat(item, item.isGroup)}
                                                    $isCompact={isCompact}
                                                    title={isCompact ? item.username : ""}
                                                >
                                                    <div className="avatar-block" style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                                                        {/* --- PULSING TYPING RING UX --- */}
                                                        {isTyping && <div className="typing-pulse-ring" style={{ position: 'absolute', top: '-4px', left: '-4px', right: '-4px', bottom: '-4px', border: '2px solid var(--msg-sent)', borderRadius: '50%', animation: 'pulseRing 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite' }} />}
                                                        
                                                        <div className={`avatar-circle ${isOnline ? 'online' : ''}`} style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
                                                            {item.isGroup ? 
                                                                <div className="group-avatar" style={{ width: '100%', height: '100%', background: 'var(--input-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--msg-sent)', fontSize: '1.2rem', fontWeight: 'bold' }}>#</div> : 
                                                                <img src={getAvatarUrl(item)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            }
                                                        </div>
                                                        {isOnline && <div className="online-badge" style={{ position: 'absolute', bottom: '2px', right: '2px', width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-panel)' }} />}
                                                        {isCompact && item.unreadCount > 0 && <span className="compact-badge" style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ff4e4e', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', width: '18px', height: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', border: '2px solid var(--bg-panel)' }}>{item.unreadCount}</span>}
                                                    </div>

                                                    {!isCompact && (
                                                        <>
                                                            <div className="details" style={{ flex: 1, overflow: 'hidden' }}>
                                                                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.username}</h3>
                                                                {item.isGroup ? (
                                                                    <p className="status group" style={{ fontSize: '0.8rem', color: 'var(--msg-sent)', margin: 0, fontWeight: '500' }}>Group Chat</p>
                                                                ) : (
                                                                    <div className="presence" style={{ fontSize: '0.8rem', color: isOnline ? '#10b981' : 'var(--text-dim)' }}>
                                                                        {isTyping ? (
                                                                            <div className="typing-indicator" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} style={{ width: '4px', height: '4px', background: 'var(--msg-sent)', borderRadius: '50%' }} />
                                                                                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} style={{ width: '4px', height: '4px', background: 'var(--msg-sent)', borderRadius: '50%' }} />
                                                                                <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} style={{ width: '4px', height: '4px', background: 'var(--msg-sent)', borderRadius: '50%' }} />
                                                                                <span style={{ color: 'var(--msg-sent)', fontStyle: 'italic', fontWeight: 'bold', marginLeft: '4px' }}>typing</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span>{isOnline ? "Online" : formatLastSeen(item.lastSeen)}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                                                <button className="pin-btn" onClick={(e) => togglePin(e, item._id)} style={{ background: 'none', border: 'none', color: isPinned ? 'var(--msg-sent)' : 'var(--text-dim)', cursor: 'pointer', opacity: isPinned ? 1 : 0, transition: '0.2s' }}>
                                                                    <FaThumbtack />
                                                                </button>
                                                                {item.unreadCount > 0 && <span className="unread-count" style={{ background: 'var(--msg-sent)', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>{item.unreadCount}</span>}
                                                            </div>
                                                        </>
                                                    )}
                                                </ContactItem>
                                            );
                                        })
                                    )}

                                    {!isCompact && searchTerm.length >= 3 && (
                                        <>
                                            <div className="section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: '700', margin: '16px 8px 8px' }}>Message History</div>
                                            {isSearchingGlobal ? (
                                                <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)' }}><FaSpinner className="fa-spin" /> Searching...</div>
                                            ) : globalMessages.length === 0 ? (
                                                <div className="empty-state" style={{ textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>No matching messages.</div>
                                            ) : (
                                                globalMessages.map(msg => {
                                                    const msgText = msg.message?.text || msg.message;
                                                    if (typeof msgText === "string" && msgText.length > 50 && !msgText.includes(" ")) return null;
                                                    return (
                                                        <div key={msg._id} className="global-msg" onClick={() => handleGlobalMessageClick(msg)} style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--glass-border)', marginBottom: '8px' }}>
                                                            <p style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '0 0 4px 0' }}>"{msgText}"</p>
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', textAlign: 'right' }}>{new Date(msg.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 6. USER FOOTER (Adaptive) */}
                        <div className="sidebar-footer" style={{ padding: isCompact ? "16px 8px" : "16px", borderTop: "1px solid var(--glass-border)", background: "var(--bg-panel)", flexShrink: 0 }}>
                            <div className="user-profile" style={{ display: 'flex', flexDirection: isCompact ? "column" : "row", alignItems: 'center', gap: isCompact ? "16px" : "12px" }}>
                                <div className="avatar" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid var(--msg-sent)', cursor: 'pointer' }} onClick={() => setShowProfileModal(true)}>
                                    <img src={getAvatarUrl(currentUser)} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                </div>

                                {!isCompact && (
                                    <div className="info" style={{ flex: 1, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setShowProfileModal(true)}>
                                        <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUserName}</h2>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--adaptive-accent)', margin: 0, fontWeight: '500' }}>{currentUser?.statusIcon || "✨"} {currentUser?.statusMessage || "Available"}</p>
                                    </div>
                                )}
                                <div className="actions" style={{ display: 'flex', gap: '4px', flexDirection: isCompact ? "column" : "row" }}>
                                    {!isCompact && (
                                        <button onClick={() => setTheme(theme === "light" ? "glass" : "light")} title="Toggle Theme" style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-dim)', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer' }}>
                                            {theme === "light" ? <FaMoon /> : <FaSun />}
                                        </button>
                                    )}
                                    <button className="logout" onClick={handleLogout} title="Logout" style={{ background: 'var(--input-bg)', border: 'none', color: '#ff4e4e', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer' }}>
                                        <FaSignOutAlt />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- MODALS --- */}
                    <AnimatePresence>
                        {showGroupModal && (
                            <ModalOverlay as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <motion.div className="modal-content" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
                                    <h3>Create Secure Group</h3>
                                    <div className="input-field">
                                        <label>Group Name</label>
                                        <input type="text" placeholder="e.g. Project Alpha" value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus />
                                    </div>
                                    <div className="member-selection">
                                        <label>Select Members</label>
                                        <div className="scroll-list">
                                            {(contacts || []).map(c => (
                                                <div key={c._id} className={`select-item ${selectedMembers?.includes(c._id) ? "selected" : ""}`} onClick={() => toggleMemberSelection(c._id)}>
                                                    <img src={getAvatarUrl(c)} alt="" />
                                                    <span>{c.username}</span>
                                                    {selectedMembers?.includes(c._id) && <FaCheck className="check" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="button-group">
                                        <button className="btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
                                        <button className="btn-primary" onClick={handleCreateGroup}>Create Group</button>
                                    </div>
                                </motion.div>
                            </ModalOverlay>
                        )}

                        {showDiscoverModal && (
                            <ModalOverlay as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <motion.div className="modal-content" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
                                    <h3>Discover Channels</h3>
                                    <div className="input-field">
                                        <FaSearch className="inner-icon" />
                                        <input type="text" placeholder="Search public channels..." value={channelSearchQuery} onChange={(e) => setChannelSearchQuery(e.target.value)} autoFocus style={{ paddingLeft: "40px" }} />
                                    </div>
                                    <div className="member-selection" style={{ minHeight: "200px" }}>
                                        {isSearchingChannels ? (
                                            <div className="center-loading"><FaSpinner className="fa-spin" /></div>
                                        ) : discoveredChannels.length > 0 ? (
                                            <div className="scroll-list">
                                                {discoveredChannels.map(channel => (
                                                    <div key={channel._id} className="channel-item">
                                                        <div className="info">
                                                            <h4>{channel.name}</h4>
                                                            <p>{channel.members?.length} subscribers</p>
                                                        </div>
                                                        <button className="btn-primary small" onClick={() => handleJoinChannel(channel._id)}>Join</button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            channelSearchQuery.length > 0 && <p className="empty-text">No channels found.</p>
                                        )}
                                    </div>
                                    <div className="button-group">
                                        <button className="btn-secondary full-width" onClick={() => { setShowDiscoverModal(false); setChannelSearchQuery(""); }}>Close</button>
                                    </div>
                                </motion.div>
                            </ModalOverlay>
                        )}

                        {showProfileModal && (
                            <ModalOverlay as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <motion.div className="modal-content profile" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
                                    <h3>Profile & Settings</h3>

                                    <div className="grid-2">
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
                        )}
                    </AnimatePresence>

                    <ToastContainer
                        position="top-center"
                        autoClose={3000}
                        hideProgressBar={true}
                        newestOnTop={true}
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme={theme === "light" ? "light" : "dark"}
                    />
                </Container>
            )}
        </>
    );
}

// --- STYLING ---
const shimmer = keyframes`
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const pulseRing = keyframes`
  0%   { transform: scale(0.9); opacity: 0.9; }
  70%  { transform: scale(1.1); opacity: 0; }
  100% { transform: scale(0.9); opacity: 0; }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: ${({ $isCompact }) => $isCompact ? "72px" : "100%"};
  transition: width var(--duration-slow) var(--ease-spring);
  background: var(--bg-surface);
  overflow: hidden;

  @keyframes pulseRing {
    0%   { transform: scale(0.9); opacity: 0.9; }
    70%  { transform: scale(1.1); opacity: 0; }
    100% { transform: scale(0.9); opacity: 0; }
  }

  .skeleton-anim {
    background: linear-gradient(90deg, var(--bg-overlay) 25%, var(--bg-hover) 50%, var(--bg-overlay) 75%);
    background-size: 200% 100%;
    animation: ${shimmer} 1.6s infinite linear;
  }
`;

const ContactItem = styled.div`
  display: flex; align-items: center; gap: 11px;
  padding: ${({ $isCompact }) => $isCompact ? "10px" : "10px 12px"};
  border-radius: var(--radius-md); cursor: pointer;
  background: transparent; border: 1px solid transparent;
  transition: all var(--duration-fast) var(--ease-out); position: relative;
  justify-content: ${({ $isCompact }) => $isCompact ? "center" : "flex-start"};

  &:hover {
    background: var(--bg-overlay);
    transform: ${({ $isCompact }) => $isCompact ? "scale(1.08)" : "none"};
  }
  &.selected {
    background: var(--bg-hover);
    border-color: var(--border-default);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }
  &.pinned { border-left: 2px solid var(--msg-sent); padding-left: ${({ $isCompact }) => $isCompact ? "10px" : "10px"}; }
  &:hover .pin-btn { opacity: 1 !important; }
  &.pinned .pin-btn { opacity: 1 !important; color: var(--msg-sent) !important; }
`;

const StoryTray = styled.div`
  flex-shrink: 0; display: flex; gap: 12px;
  padding: 0 16px 14px; overflow-x: auto; -webkit-overflow-scrolling: touch;
  border-bottom: 1px solid var(--border-subtle);
  &::-webkit-scrollbar { display: none; }

  .story-item {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    cursor: pointer; min-width: 58px;
    p {
      font-size: var(--text-2xs); color: var(--text-secondary); font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 58px; text-align: center;
    }

    .story-ring {
      width: 54px; height: 54px; border-radius: 50%; padding: 2.5px;
      position: relative; background: var(--border-default);
      transition: transform var(--duration-fast) var(--ease-spring);
      &:hover { transform: scale(1.06); }
      img {
        width: 100%; height: 100%; border-radius: 50%;
        border: 2.5px solid var(--bg-surface); object-fit: cover;
      }
      &.unread {
        background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
        box-shadow: 0 4px 14px rgba(220,39,67,0.3);
      }
      &.empty {
        background: none; border: 1.5px dashed var(--border-default); padding: 2px;
      }
      .add-icon {
        position: absolute; bottom: -2px; right: -2px;
        background: var(--msg-sent); color: white; border-radius: 50%;
        width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
        font-size: 0.65rem; border: 2px solid var(--bg-surface);
        box-shadow: 0 2px 8px rgba(124,58,237,0.4);
      }
    }
  }
`;

const StoryPreviewTooltip = styled(motion.div)`
  position: absolute; top: 120px; left: 16px;
  background: var(--glass-noise), var(--bg-panel);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border); border-radius: var(--radius-lg);
  padding: 12px; display: flex; align-items: center; gap: 12px;
  z-index: 50; box-shadow: var(--glass-shadow);

  img { width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover; }
  .info {
    h4 { color: var(--text-primary); font-size: var(--text-sm); font-weight: 700; margin-bottom: 2px; }
    p  { color: var(--text-secondary); font-size: var(--text-xs); }
  }
`;

const ModalOverlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: var(--z-modal-overlay);
  display: flex; justify-content: center; align-items: center;
  padding: 1rem;

  .modal-content {
    background: var(--glass-noise), var(--bg-panel);
    border: 1px solid var(--glass-border); border-radius: var(--radius-2xl);
    padding: clamp(1.5rem, 4vw, 2rem); width: min(460px, 95vw);
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 32px 80px rgba(0,0,0,0.5);
    animation: modalIn 0.3s var(--ease-spring);

    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.93) translateY(16px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }
    &.profile { width: min(520px, 95vw); }

    h3 {
      font-size: var(--text-lg); color: var(--text-primary);
      font-weight: 800; margin-bottom: 1.5rem; text-align: center;
    }

    .section-divider {
      margin: 1.5rem 0 1rem; font-size: var(--text-xs); text-transform: uppercase;
      color: var(--msg-sent); font-weight: 800; letter-spacing: 0.6px;
      display: flex; align-items: center; gap: 8px;
      border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;
    }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    .input-field {
      margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; position: relative;

      label {
        font-size: var(--text-xs); text-transform: uppercase; font-weight: 700;
        color: var(--text-secondary); letter-spacing: 0.4px;
      }
      .inner-icon { position: absolute; bottom: 13px; left: 13px; color: var(--text-tertiary); }

      input, select, textarea {
        width: 100%; background: var(--input-bg); border: 1px solid var(--border-default);
        color: var(--text-primary); padding: 11px 14px;
        border-radius: var(--radius-md); font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: var(--text-sm); transition: all var(--duration-base); outline: none;
        &:focus {
          border-color: var(--msg-sent); background: rgba(124,58,237,0.06);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
      }
      textarea { resize: none; height: 90px; }
      .flex-row { display: flex; gap: 10px; }
    }

    .setting-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px; background: var(--input-bg); padding: 14px 16px;
      border-radius: var(--radius-md); border: 1px solid var(--border-subtle);
      .text {
        label { color: var(--text-primary); font-weight: 700; font-size: var(--text-sm); display: block; }
        p { color: var(--text-secondary); font-size: var(--text-xs); margin-top: 2px; }
      }
    }

    .ios-switch {
      width: 48px; height: 28px; border-radius: 28px;
      background: var(--border-strong); position: relative; cursor: pointer; transition: 0.3s; flex-shrink: 0;
      .knob {
        position: absolute; top: 2px; left: 2px;
        width: 24px; height: 24px; background: white; border-radius: 50%;
        transition: 0.3s; box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      }
      &.on { background: var(--color-success); .knob { left: 22px; } }
    }

    .toggle-btn {
      width: 100%; padding: 11px; border-radius: var(--radius-md);
      border: 1px solid var(--border-default); background: var(--input-bg);
      color: var(--text-primary); font-weight: 700; font-size: var(--text-sm);
      font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; transition: all var(--duration-base);
      &.on {
        background: var(--msg-sent); border-color: var(--msg-sent); color: white;
        box-shadow: 0 4px 16px rgba(124,58,237,0.35);
      }
    }

    .member-selection {
      background: var(--input-bg); border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle); overflow: hidden; margin-bottom: 20px;

      label {
        display: block; padding: 10px 14px;
        background: var(--bg-overlay); font-size: var(--text-xs); font-weight: 700;
        color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle);
        text-transform: uppercase; letter-spacing: 0.4px;
      }

      .scroll-list {
        max-height: 200px; overflow-y: auto;
        &::-webkit-scrollbar { width: 4px; }
        &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }
      }

      .select-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 14px; border-bottom: 1px solid var(--border-subtle);
        cursor: pointer; transition: all var(--duration-fast);
        img { width: 30px; height: 30px; border-radius: 50%; }
        span { flex: 1; font-weight: 600; font-size: var(--text-sm); color: var(--text-primary); }
        .check { color: var(--msg-sent); }
        &:hover { background: var(--bg-overlay); }
        &.selected { background: rgba(124,58,237,0.08); }
      }

      .channel-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px; border-bottom: 1px solid var(--border-subtle);
        .info {
          h4 { color: var(--text-primary); font-size: var(--text-sm); font-weight: 700; }
          p { color: var(--text-secondary); font-size: var(--text-xs); margin-top: 2px; }
        }
      }

      .center-loading { display: flex; justify-content: center; align-items: center; height: 90px; font-size: 1.4rem; color: var(--msg-sent); }
      .empty-text { text-align: center; color: var(--text-secondary); padding: 28px; font-style: italic; font-size: var(--text-sm); }
    }

    .button-group {
      display: flex; gap: 10px;
      button {
        flex: 1; padding: 13px; border-radius: var(--radius-md);
        font-weight: 700; font-size: var(--text-sm); cursor: pointer;
        transition: all var(--duration-base); border: none;
        display: flex; justify-content: center; align-items: center; gap: 6px;
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      .btn-primary {
        background: linear-gradient(135deg, var(--msg-sent), #6366f1);
        color: white; box-shadow: 0 6px 20px rgba(124,58,237,0.3);
        &:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(124,58,237,0.4); filter: brightness(1.1); }
      }
      .btn-secondary {
        background: transparent; border: 1px solid var(--border-default) !important;
        color: var(--text-primary);
        &:hover { background: var(--input-bg); }
      }
      .small { padding: 8px 14px; flex: none; border-radius: var(--radius-full); font-size: var(--text-xs); }
      .full-width { flex: 1; width: 100%; }
    }
  }
`;