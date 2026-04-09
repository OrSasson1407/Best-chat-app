import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaUserFriends, FaSearch, FaTimes, FaChevronLeft, FaChevronRight,
    FaThumbtack, FaUserCircle, FaBellSlash, FaArchive, FaBoxOpen
} from "react-icons/fa";
import { BsChatDotsFill, BsPeopleFill } from "react-icons/bs";
import { MdOutlineAllInclusive } from "react-icons/md";
import { FaRegEnvelope } from "react-icons/fa";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// API Routes
import {
    getUserGroupsRoute, updateProfileRoute, searchMessageRoute, getStoryFeedRoute, 
    addStoryRoute, viewStoryRoute, searchChannelsRoute, joinChannelRoute, 
    publicKeyRoute, createGroupRoute, archiveChatRoute, muteChatRoute
} from "../../utils/APIRoutes";

// Store & Utils
import useChatStore from "../../store/chatStore";
import { generateGroupAESKey, encryptMessage } from "../../utils/crypto";

// Sub-Components
import UserProfile from "../UserProfile";
import FriendRequests from "../FriendRequests";
import SidebarFooter from "./SidebarFooter";
import StoryTraySection from "./StoryTraySection";
import ContactList from "./ContactList";
import CreateGroupModal from "./Modals/CreateGroupModal";
import DiscoverModal from "./Modals/DiscoverModal";
import ProfileSettingsModal from "./Modals/ProfileSettingsModal";

// Styled Components
import { Container, ContextMenu, StoryPreviewTooltip } from "./Contacts.styles";

const femaleTops = "longHairBob,longHairBun,longHairCurly,longHairCurvy,longHairStraight,longHairNotTooLong";
const maleTops = "shortHairDreads01,shortHairDreads02,shortHairFrizzle,shortHairShaggy,shortHairShortCurly,shortHairShortFlat,shortHairShortRound,shortHairShortWaved,shortHairSides";
const backgroundColors = "b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc";

export const formatLastSeen = (dateString) => {
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

export default function Contacts({ contacts, changeChat, handleLogout, socket }) {
    const {
        currentUser, updateCurrentUser, onlineUsers, theme, setTheme,
        isCompact, setIsCompact, globalTypingUsers,
        mutedChats, setMutedChats, isChatMuted, chatFolders, setChatFolders, pendingRequestCount, setPendingRequestCount,
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

    const [archivedIds, setArchivedIds] = useState(() => {
        try {
            const saved = localStorage.getItem(`archived-chats-${currentUser?._id}`);
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });
    
    const [contextMenu, setContextMenu] = useState(null); 
    const contextMenuRef = useRef(null);

    const [showUserProfile, setShowUserProfile] = useState(null); 
    const [showFriendRequests, setShowFriendRequests] = useState(false);
    const [activeFolderCustomId, setActiveFolderCustomId] = useState(null); 

    const [groups, setGroups] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const [globalMessages, setGlobalMessages] = useState([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

    // Modals state
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [groupSearchTerm, setGroupSearchTerm] = useState(""); 
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showDiscoverModal, setShowDiscoverModal] = useState(false);

    // Channels state
    const [channelSearchQuery, setChannelSearchQuery] = useState("");
    const [discoveredChannels, setDiscoveredChannels] = useState([]);
    const [isSearchingChannels, setIsSearchingChannels] = useState(false);

    // User Profile state
    const [profileData, setProfileData] = useState({
        statusIcon: "✨", statusMessage: "Available", bio: "", interests: "",
        privacySettings: { lastSeen: "everyone", readReceipts: true, profilePhoto: "everyone" }
    });
    const [hasPin, setHasPin] = useState(!!localStorage.getItem("app-pin-code"));
    const [avatarPreview, setAvatarPreview] = useState(null);

    // Stories state
    const [storyFeed, setStoryFeed] = useState([]);
    const [viewingStoryUser, setViewingStoryUser] = useState(null);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [isUploadingStory, setIsUploadingStory] = useState(false);
    const fileInputRef = useRef(null);
    const avatarUploadRef = useRef(null);
    const pressTimer = useRef(null);
    const [storyPreview, setStoryPreview] = useState(null);

    const getAuthHeader = useCallback(() => {
        const rawToken = currentUser?.token || sessionStorage.getItem("chat-app-token") || "";
        const cleanToken = rawToken.replace(/(Bearer\s*)+/gi, "").trim();
        return { headers: { Authorization: `Bearer ${cleanToken}` } };
    }, [currentUser]);

    useEffect(() => {
        const fetchGroupsAndStories = async () => {
            if (currentUser) {
                try {
                    const [groupRes, storyRes] = await Promise.all([
                        axios.get(getUserGroupsRoute, getAuthHeader()), 
                        axios.get(getStoryFeedRoute, getAuthHeader()) 
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
    }, [currentUser?._id]); 

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

    useEffect(() => {
        if (!socket?.current) return;
        const handleGroupCreated = (newGroup) => {
            setGroups((prev) => {
                if (prev.some((g) => g._id === newGroup._id)) return prev;
                return [...prev, newGroup];
            });
            toast.info(`📣 You were added to "${newGroup.name}"`);
        };
        socket.current.on("group-created", handleGroupCreated);
        return () => { socket.current?.off("group-created", handleGroupCreated); };
    }, [socket?.current]); 

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
                }, getAuthHeader()); 
                if (data.status) setGlobalMessages(data.messages || []);
            } catch (error) {
                console.error("[API] Error searching messages:", error);
            } finally {
                setIsSearchingGlobal(false);
            }
        }, 600);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, currentUser, getAuthHeader]);

    useEffect(() => {
        if (!channelSearchQuery) {
            setDiscoveredChannels([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingChannels(true);
            try {
                const { data } = await axios.get(`${searchChannelsRoute}?query=${channelSearchQuery}`, getAuthHeader()); 
                if (data.status) setDiscoveredChannels(data.channels || []);
            } catch (error) {
                console.error("[API] Error searching channels:", error);
            } finally {
                setIsSearchingChannels(false);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [channelSearchQuery, currentUser, getAuthHeader]);

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

    const toggleArchive = useCallback(async (item) => {
        setContextMenu(null);
        const chatId = item._id;
        const token = currentUser?.token || sessionStorage.getItem("chat-app-token");
        try {
            const { data } = await axios.post(archiveChatRoute, { chatId }, { headers: { Authorization: `Bearer ${token}` } });
            if (data.status) {
                const newArchived = data.archivedChats.map(String);
                setArchivedIds(newArchived);
                localStorage.setItem(`archived-chats-${currentUser._id}`, JSON.stringify(newArchived));
                const isNowArchived = newArchived.includes(String(chatId));
                toast.success(isNowArchived ? "Chat archived." : "Chat unarchived.");
            }
        } catch {
            toast.error("Failed to update archive.");
        }
    }, [currentUser]);

    const handleMuteChat = useCallback(async (item, durationMinutes) => {
        setContextMenu(null);
        const chatId = item._id;
        const token = currentUser?.token || sessionStorage.getItem("chat-app-token");
        try {
            const { data } = await axios.post(muteChatRoute, { chatId, duration: durationMinutes }, { headers: { Authorization: `Bearer ${token}` } });
            if (data.status) {
                setMutedChats(data.mutedChats);
                toast.success(durationMinutes === null ? "Chat unmuted." : "Chat muted.");
            }
        } catch { toast.error("Failed to mute chat."); }
    }, [currentUser, setMutedChats]);

    useEffect(() => {
        const handler = (e) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
                setContextMenu(null);
            }
        };
        if (contextMenu) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [contextMenu]);

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
                }, getAuthHeader()); 
                if (data.status) {
                    toast.success("Status updated.");
                    const storyRes = await axios.get(getStoryFeedRoute, getAuthHeader()); 
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
                await axios.post(`${viewStoryRoute}/${firstStory._id}`, {}, getAuthHeader()); 
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
                    await axios.post(`${viewStoryRoute}/${nextStory._id}`, {}, getAuthHeader()); 
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
        if (isCreatingGroup) return;
        if (groupName.length < 3) return toast.error("Group name must be at least 3 characters.");
        if (selectedMembers.length < 1) return toast.error("Please select at least 1 member.");

        setIsCreatingGroup(true);
        try {
            const allMembers = [...selectedMembers, currentUser._id];

            console.log(`[Crypto] Generating AES Group Key for ${allMembers.length} members...`);
            const aesKeyJwk = await generateGroupAESKey();
            const aesKeyString = JSON.stringify(aesKeyJwk);

            const keyPromises = allMembers.map(async (userId) => {
                try {
                    const pkResponse = await axios.get(`${publicKeyRoute}/${userId}`, getAuthHeader()); 
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

            if (groupKeys.length < allMembers.length) {
                toast.warning("⚠️ Some members lack E2E keys. They will be added but won't be able to decrypt messages until they log in.", { autoClose: 6000 });
            }

            const { data } = await axios.post(createGroupRoute, {
                name: groupName,
                members: allMembers,
                admin: currentUser._id,
                groupKeys
            }, getAuthHeader()); 

            if (data.status) {
                const groupRes = await axios.get(getUserGroupsRoute, getAuthHeader());
                setGroups(groupRes.data || []);

                setShowGroupModal(false);
                setGroupName("");
                setSelectedMembers([]);
                setGroupSearchTerm("");
                toast.success("Group created successfully.");
            }
        } catch (error) {
            console.error("[API] Failed to create group", error);
            toast.error("Failed to create group. Please try again.");
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const handleJoinChannel = async (channelId) => {
        try {
            const { data } = await axios.post(joinChannelRoute, { channelId }, getAuthHeader()); 
            if (data.status) {
                toast.success("Joined channel.");
                setShowDiscoverModal(false);
                setGroups(prev => [...prev, data.channel]);
            }
        } catch (error) {
            toast.error(error.response?.data?.msg || "Failed to join channel.");
        }
    };

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image must be under 2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setAvatarPreview(ev.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateProfile = async () => {
        try {
            const interestsArray = profileData.interests
                ? profileData.interests.split(",").map(i => i.trim()).filter(i => i !== "")
                : [];

            const { data } = await axios.post(`${updateProfileRoute}/${currentUser._id}`, {
                ...profileData,
                interests: interestsArray,
                ...(avatarPreview ? { avatarImage: avatarPreview } : {})
            }, getAuthHeader()); 

            if (data.status) {
                const currentToken = sessionStorage.getItem("chat-app-token");
                const updatedUser = { ...data.user, token: currentToken };
                sessionStorage.setItem("chat-app-user", JSON.stringify(updatedUser));
                updateCurrentUser(data.user); 
                setAvatarPreview(null);
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

        if (activeFolderCustomId) {
            const folder = chatFolders.find(f => f._id === activeFolderCustomId);
            const ids = (folder?.chatIds || []).map(String);
            all = all.filter(i => ids.includes(String(i._id)));
        } else if (activeFolder === "archived") {
            all = all.filter(i => archivedIds.includes(String(i._id)));
        } else {
            all = all.filter(i => !archivedIds.includes(String(i._id)));
            if (activeFolder === "personal") all = all.filter(i => !i.isGroup);
            if (activeFolder === "groups") all = all.filter(i => i.isGroup);
            if (activeFolder === "unread") all = all.filter(i => i.unreadCount > 0);
        }

        return all.sort((a, b) => {
            const aPinned = pinnedIds?.includes(a._id);
            const bPinned = pinnedIds?.includes(b._id);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;

            const aOnline = !a.isGroup && onlineUsers?.includes(a._id);
            const bOnline = !b.isGroup && onlineUsers?.includes(b._id);
            if (aOnline !== bOnline) return aOnline ? -1 : 1;

            return (a.username || "").localeCompare(b.username || "");
        });
    }, [contacts, groups, searchTerm, activeFolder, activeFolderCustomId, pinnedIds, onlineUsers, archivedIds, chatFolders]);

    const folders = [
        { id: "all", icon: <MdOutlineAllInclusive />, title: "All", badge: totalUnreadChatsCount },
        { id: "personal", icon: <BsChatDotsFill size={14} />, title: "Personal", badge: unreadPersonalChatsCount },
        { id: "groups", icon: <BsPeopleFill />, title: "Groups", badge: unreadGroupsCount },
        { id: "unread", icon: <FaRegEnvelope size={14} />, title: "Unread", badge: totalUnreadChatsCount, danger: true },
        { id: "archived", icon: <FaArchive size={13} />, title: "Archive", badge: archivedIds.length || 0 },
    ];

    return (
        <>
            {currentUser && (
                <>
                    <Container $isCompact={isCompact} $themeType={theme}>
                        <div className="sidebar-dynamic-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            
                            {/* --- BRAND HEADER --- */}
                            <div className="brand-area" style={{ padding: isCompact ? "20px 0" : "24px", display: 'flex', justifyContent: isCompact ? 'center' : 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                {!isCompact && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <motion.h3 style={{ color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '2px', margin: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>SNAPPY</motion.h3>
                                        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowFriendRequests(!showFriendRequests)} title="Contact requests">
                                            <FaUserFriends style={{ color: 'var(--text-secondary)', fontSize: '1rem' }} />
                                            {pendingRequestCount > 0 && (
                                                <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--msg-sent)', color: 'white', fontSize: '0.6rem', fontWeight: 800, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {pendingRequestCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <button 
                                    className="sidebar-toggle-trigger" 
                                    onClick={() => setIsCompact(!isCompact)}
                                    style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-dim)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                >
                                    {isCompact ? <FaChevronRight /> : <FaChevronLeft />}
                                </button>
                            </div>

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

                            {/* --- STORY TRAY COMPONENT --- */}
                            {!isCompact && (
                                <StoryTraySection
                                    currentUser={currentUser}
                                    storyFeed={storyFeed}
                                    isUploadingStory={isUploadingStory}
                                    fileInputRef={fileInputRef}
                                    handleStoryUpload={handleStoryUpload}
                                    openStoryViewer={openStoryViewer}
                                    handleStoryPressStart={handleStoryPressStart}
                                    handleStoryPressEnd={handleStoryPressEnd}
                                    getAvatarUrl={getAvatarUrl}
                                />
                            )}

                            {/* --- FOLDERS NAVIGATION --- */}
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

                            {/* --- SEARCH BAR --- */}
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

                            {/* --- CONTACT LIST COMPONENT --- */}
                            <ContactList
                                isLoading={isLoading}
                                isCompact={isCompact}
                                activeFolder={activeFolder}
                                searchTerm={searchTerm}
                                setShowGroupModal={setShowGroupModal}
                                setShowDiscoverModal={setShowDiscoverModal}
                                displayedItems={displayedItems}
                                onlineUsers={onlineUsers}
                                pinnedIds={pinnedIds}
                                globalTypingUsers={globalTypingUsers}
                                currentSelected={currentSelected}
                                changeCurrentChat={changeCurrentChat}
                                setContextMenu={setContextMenu}
                                getAvatarUrl={getAvatarUrl}
                                formatLastSeen={formatLastSeen}
                                togglePin={togglePin}
                                isChatMuted={isChatMuted}
                                isSearchingGlobal={isSearchingGlobal}
                                globalMessages={globalMessages}
                                handleGlobalMessageClick={handleGlobalMessageClick}
                            />

                            {/* --- SIDEBAR FOOTER COMPONENT --- */}
                            <SidebarFooter
                                isCompact={isCompact}
                                currentUser={currentUser}
                                currentUserName={currentUserName}
                                theme={theme}
                                setTheme={setTheme}
                                handleLogout={handleLogout}
                                setShowProfileModal={setShowProfileModal}
                                getAvatarUrl={getAvatarUrl}
                            />
                        </div>

                        {/* --- MODALS SECTION --- */}
                        <AnimatePresence>
                            {showGroupModal && (
                                <CreateGroupModal 
                                    setShowGroupModal={setShowGroupModal}
                                    groupName={groupName}
                                    setGroupName={setGroupName}
                                    groupSearchTerm={groupSearchTerm}
                                    setGroupSearchTerm={setGroupSearchTerm}
                                    contacts={contacts}
                                    selectedMembers={selectedMembers}
                                    toggleMemberSelection={toggleMemberSelection}
                                    handleCreateGroup={handleCreateGroup}
                                    isCreatingGroup={isCreatingGroup}
                                    getAvatarUrl={getAvatarUrl}
                                />
                            )}

                            {showDiscoverModal && (
                                <DiscoverModal 
                                    setShowDiscoverModal={setShowDiscoverModal}
                                    channelSearchQuery={channelSearchQuery}
                                    setChannelSearchQuery={setChannelSearchQuery}
                                    isSearchingChannels={isSearchingChannels}
                                    discoveredChannels={discoveredChannels}
                                    handleJoinChannel={handleJoinChannel}
                                />
                            )}

                            {showProfileModal && (
                                <ProfileSettingsModal 
                                    setShowProfileModal={setShowProfileModal}
                                    profileData={profileData}
                                    setProfileData={setProfileData}
                                    avatarPreview={avatarPreview}
                                    setAvatarPreview={setAvatarPreview}
                                    handleAvatarUpload={handleAvatarUpload}
                                    avatarUploadRef={avatarUploadRef}
                                    getAvatarUrl={getAvatarUrl}
                                    currentUser={currentUser}
                                    theme={theme}
                                    setTheme={setTheme}
                                    isCompact={isCompact}
                                    setIsCompact={setIsCompact}
                                    hasPin={hasPin}
                                    setHasPin={setHasPin}
                                    handleUpdateProfile={handleUpdateProfile}
                                />
                            )}
                        </AnimatePresence>
                    </Container>

                    {/* --- OUT-OF-CONTAINER OVERLAYS --- */}
                    {showUserProfile && (
                        <UserProfile
                            userId={showUserProfile}
                            onClose={() => setShowUserProfile(null)}
                            onStartChat={(user) => { changeChat(user, false); setShowUserProfile(null); }}
                        />
                    )}

                    {showFriendRequests && (
                        <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 1000 }}>
                            <FriendRequests
                                onClose={() => setShowFriendRequests(false)}
                                onAccepted={() => {/* contacts refresh handled by socket/re-fetch */}}
                            />
                        </div>
                    )}

                    {/* --- CONTEXT MENU --- */}
                    {contextMenu && (
                        <ContextMenu
                            ref={contextMenuRef}
                            style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 200) }}
                        >
                            <div className="ctx-item" onClick={() => { togglePin(new MouseEvent("click"), contextMenu.item._id); setContextMenu(null); }}>
                                <FaThumbtack />
                                {pinnedIds.includes(contextMenu.item._id) ? "Unpin chat" : "Pin chat"}
                            </div>
                            <div className="ctx-item" onClick={() => { setContextMenu(null); setShowUserProfile(contextMenu.item._id); }}>
                                <FaUserCircle />View profile
                            </div>
                            {isChatMuted(contextMenu.item._id) ? (
                                <div className="ctx-item" onClick={() => handleMuteChat(contextMenu.item, null)}>
                                    <FaBellSlash />Unmute
                                </div>
                            ) : (
                                <>
                                    <div className="ctx-item" onClick={() => handleMuteChat(contextMenu.item, 60)}><FaBellSlash />Mute 1 hour</div>
                                    <div className="ctx-item" onClick={() => handleMuteChat(contextMenu.item, 10080)}><FaBellSlash />Mute 1 week</div>
                                    <div className="ctx-item" onClick={() => handleMuteChat(contextMenu.item, 0)}><FaBellSlash />Mute forever</div>
                                </>
                            )}
                            <div className="ctx-item" onClick={() => toggleArchive(contextMenu.item)}>
                                {archivedIds.includes(String(contextMenu.item._id)) ? <><FaBoxOpen /> Unarchive</> : <><FaArchive /> Archive chat</>}
                            </div>
                        </ContextMenu>
                    )}
                </>
            )}
        </>
    );
}