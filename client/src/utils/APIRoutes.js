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
// 1. Use REACT_APP_API_URL if defined (.env file)
// 2. If production but env missing → fallback to Render URL
// 3. Otherwise → localhost for development

export const host = process.env.REACT_APP_API_URL || "http://localhost:5000";

// =======================================================
// AUTH & USER ROUTES
// =======================================================

export const loginRoute = `${host}/api/auth/login`;
export const registerRoute = `${host}/api/auth/register`;
export const logoutRoute = `${host}/api/auth/logout`;
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

export const createChannelRoute = `${host}/api/groups/channel/create`;
export const searchChannelsRoute = `${host}/api/groups/channel/search`;
export const joinChannelRoute = `${host}/api/groups/channel/join`;


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


// =======================================================
// END-TO-END ENCRYPTION ROUTES (UPDATED)
// =======================================================

// 🔧 IMPORTANT FIX: 
// Backend registers the public key routes under the Auth Controller
// app.use("/api/auth", authRoutes)

export const publicKeyRoute = `${host}/api/auth/public-key`; // For GET requests
export const updateE2EKeysRoute = `${host}/api/auth/e2e-keys`; // For POST requests