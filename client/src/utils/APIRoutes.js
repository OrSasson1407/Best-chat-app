/**
 * API Routes Configuration
 * ------------------------------------------------
 * This file centralizes all backend API endpoints.
 * It dynamically chooses the correct backend host
 * depending on environment (development / production).
 */

// =======================================================
// HOST CONFIGURATION
// =======================================================

// Priority:
// 1. Use VITE_API_URL if defined in your Render Environment Variables
// 2. Otherwise → Automatically detect if we are in DEV (localhost) or PROD (live URL)
export const host = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV 
    ? "http://localhost:5000" 
    : "https://your-backend-app.onrender.com" // 🚨 REPLACE THIS WITH YOUR LIVE RENDER BACKEND URL
);

// =======================================================
// AUTH & USER ROUTES
// =======================================================

export const loginRoute = `${host}/api/auth/login`;
export const registerRoute = `${host}/api/auth/register`;
export const logoutRoute = `${host}/api/auth/logout`;
export const refreshTokenRoute = `${host}/api/auth/refresh`; // ✅ FIX: was missing — needed for silent token renewal
export const allUsersRoute = `${host}/api/auth/allusers`;
export const setAvatarRoute = `${host}/api/auth/setavatar`;
export const updateProfileRoute = `${host}/api/auth/updateprofile`;
export const blockUserRoute = `${host}/api/auth/block`;
export const getUserByIdRoute = `${host}/api/auth/user`;

// FCM / Push Notifications
export const fcmTokenRoute = `${host}/api/auth/fcm-token`;
export const updateFcmTokenRoute = `${host}/api/auth/update-fcm`;

// Chat Customization
export const updateChatCustomizationRoute = `${host}/api/auth/chat-customization`;


// =======================================================
// MESSAGE ROUTES
// =======================================================

export const sendMessageRoute = `${host}/api/messages/addmsg`;
export const receiveMessageRoute = `${host}/api/messages/getmsg`;
export const reactMessageRoute = `${host}/api/messages/react`;
export const deleteMessageRoute = `${host}/api/messages/deletemsg`;
export const deleteMessageForMeRoute = `${host}/api/messages/deletemsgforme`;
export const editMessageRoute = `${host}/api/messages/editmsg`;
export const searchMessageRoute = `${host}/api/messages/search`;
export const getChatMediaRoute = `${host}/api/messages/getmedia`;


// =======================================================
// GROUP ROUTES
// =======================================================

export const createGroupRoute = `${host}/api/groups/create`;
export const getUserGroupsRoute = `${host}/api/groups/getgroups`;
export const getGroupMessagesRoute = `${host}/api/groups/getmessages`;
export const addGroupMemberRoute = `${host}/api/groups/addmember`;
export const removeGroupMemberRoute = `${host}/api/groups/removemember`;


// =======================================================
// CHANNEL ROUTES
// =======================================================

export const createChannelRoute = `${host}/api/groups/createChannel`;  // ✅ FIX: was /channel/create, backend has /createChannel
export const searchChannelsRoute = `${host}/api/groups/searchChannels`; // ✅ FIX: was /channel/search, backend has /searchChannels
export const joinChannelRoute = `${host}/api/groups/joinChannel`;        // ✅ FIX: was /channel/join, backend has /joinChannel


// =======================================================
// ADMIN / MODERATION ROUTES
// =======================================================

export const promoteToModeratorRoute = `${host}/api/groups/promoteToModerator`;
export const demoteModeratorRoute = `${host}/api/groups/demoteModerator`;
export const promoteToAdminRoute = `${host}/api/groups/promoteToAdmin`;
export const kickMemberRoute = `${host}/api/groups/kickMember`;


// =======================================================
// STORY ROUTES
// =======================================================

export const addStoryRoute = `${host}/api/stories/add`;
export const getStoryFeedRoute = `${host}/api/stories/feed`;
export const viewStoryRoute = `${host}/api/stories/view`;


// =======================================================
// AI ROUTES
// =======================================================

export const getQuickRepliesRoute = `${host}/api/ai/quick-replies`;
export const translateMessageRoute = `${host}/api/ai/translate`;
export const summarizeChatRoute = `${host}/api/ai/summarize`;


// =======================================================
// END-TO-END ENCRYPTION ROUTES
// =======================================================

export const publicKeyRoute = `${host}/api/auth/public-key`;
export const updateE2EKeysRoute = `${host}/api/auth/e2e-keys`;