import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaThumbtack, FaUserCircle, FaBellSlash, FaArchive, FaBoxOpen } from "react-icons/fa";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// API Routes
import {
    getUserGroupsRoute, updateProfileRoute, searchMessageRoute,
    searchChannelsRoute, joinChannelRoute, publicKeyRoute, 
    createGroupRoute, archiveChatRoute, muteChatRoute
} from "../../utils/APIRoutes";

// Store & Utils
import useChatStore from "../../store/chatStore";
import { generateGroupAESKey, encryptMessage } from "../../utils/crypto";

// Sub-Components
import UserProfile from "../Common/UserProfile";
import FriendRequests from "../Common/FriendRequests";

// Modular Sidebar Components
import BrandHeader from "./Navigation/BrandHeader";
import FolderTabs from "./Navigation/FolderTabs";
import SearchBar from "./Navigation/SearchBar";
import ContactList from "./ContactList/ContactList";
import StoryTraySection from "./Stories/StoryTraySection";
import SidebarFooter from "./Footer/SidebarFooter";

// Modals
import CreateGroupModal from "./Modals/CreateGroupModal";
import DiscoverModal from "./Modals/DiscoverModal";
import ProfileSettingsModal from "./Modals/ProfileSettingsModal";

// Custom Hooks
import useStories from "./Stories/useStories";

// Styled Components
import { Container, ContextMenu } from "./Contacts.styles";

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
        isCompact, setIsCompact, globalTypingUsers, setMutedChats, 
        isChatMuted, chatFolders, pendingRequestCount
    } = useChatStore();

    const [currentUserName, setCurrentUserName] = useState(currentUser?.username);
    const [currentSelected, setCurrentSelected] = useState(undefined);
    const [activeFolder, setActiveFolder] = useState("all");

    // ✅ FIX: Safely fallback to an empty object so the hook doesn't crash reading '._id' during the first render
    const {
        storyFeed, isUploadingStory, fileInputRef, storyPreview,
        fetchStories, handleStoryUpload, openStoryViewer,
        handleStoryPressStart, handleStoryPressEnd
    } = useStories(currentUser || {});

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
    const avatarUploadRef = useRef(null);

    const getAuthHeader = useCallback(() => {
        const rawToken = currentUser?.token || sessionStorage.getItem("chat-app-token") || "";
        const cleanToken = rawToken.replace(/(Bearer\s*)+/gi, "").trim();
        return { headers: { Authorization: `Bearer ${cleanToken}` } };
    }, [currentUser]);

    useEffect(() => {
        const fetchGroupsAndInitialize = async () => {
            if (currentUser) {
                try {
                    const groupRes = await axios.get(getUserGroupsRoute, getAuthHeader());
                    setGroups(groupRes.data || []);
                    if (fetchStories) fetchStories(); // Call the modularized fetch
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
            fetchGroupsAndInitialize();
        }
    }, [currentUser?._id, getAuthHeader, fetchStories]); 

    useEffect(() => {
        if (currentUser) localStorage.setItem(`pinned-chats-${currentUser._id}`, JSON.stringify(pinnedIds));
    }, [pinnedIds, currentUser]);

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
    }, [socket]); 

    useEffect(() => {
        if (!searchTerm || searchTerm.length < 3 || !currentUser?._id) {
            setGlobalMessages([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingGlobal(true);
            try {
                const { data } = await axios.post(searchMessageRoute, {
                    userId: currentUser._id, query: searchTerm
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
        if (!channelSearchQuery || !currentUser?._id) {
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
        if (!currentUser) return;
        
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
        if (!currentUser) return;
        
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
        if (!currentUser) return;
        
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

    const toggleMemberSelection = (id) => {
        setSelectedMembers(prev => prev?.includes(id) ? prev.filter(m => m !== id) : [...(prev || []), id]);
    };

    const handleCreateGroup = async () => {
        if (isCreatingGroup || !currentUser) return;
        if (groupName.length < 3) return toast.error("Group name must be at least 3 characters.");
        if (selectedMembers.length < 1) return toast.error("Please select at least 1 member.");

        setIsCreatingGroup(true);
        try {
            const allMembers = [...selectedMembers, currentUser._id];
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
                name: groupName, members: allMembers, admin: currentUser._id, groupKeys
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
        reader.onload = (ev) => setAvatarPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const handleUpdateProfile = async () => {
        if (!currentUser) return;
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

    return (
        <>
            {currentUser && (
                <>
                    <Container $isCompact={isCompact} $themeType={theme}>
                        <div className="sidebar-dynamic-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            
                            {/* --- MODULAR BRAND HEADER --- */}
                            <BrandHeader 
                                isCompact={isCompact}
                                setIsCompact={setIsCompact}
                                showFriendRequests={showFriendRequests}
                                setShowFriendRequests={setShowFriendRequests}
                                pendingRequestCount={pendingRequestCount}
                            />

                            {/* --- MODULAR STORY TRAY COMPONENT --- */}
                            {!isCompact && (
                                <StoryTraySection
                                    currentUser={currentUser}
                                    storyFeed={storyFeed}
                                    isUploadingStory={isUploadingStory}
                                    fileInputRef={fileInputRef}
                                    storyPreview={storyPreview}
                                    handleStoryUpload={handleStoryUpload}
                                    openStoryViewer={openStoryViewer}
                                    handleStoryPressStart={handleStoryPressStart}
                                    handleStoryPressEnd={handleStoryPressEnd}
                                    getAvatarUrl={getAvatarUrl}
                                />
                            )}

                            {/* --- MODULAR FOLDERS NAVIGATION --- */}
                            <FolderTabs 
                                isCompact={isCompact}
                                activeFolder={activeFolder}
                                setActiveFolder={setActiveFolder}
                                totalUnreadChatsCount={totalUnreadChatsCount}
                                unreadPersonalChatsCount={unreadPersonalChatsCount}
                                unreadGroupsCount={unreadGroupsCount}
                                archivedCount={archivedIds.length || 0}
                            />

                            {/* --- MODULAR SEARCH BAR --- */}
                            <SearchBar 
                                isCompact={isCompact}
                                activeFolder={activeFolder}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                            />

                            {/* --- MODULAR CONTACT LIST COMPONENT --- */}
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

                            {/* --- MODULAR SIDEBAR FOOTER COMPONENT --- */}
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