// --- MERGE UPDATE: Dynamic Environment Host ---
// Replace the production URL with your actual deployed backend URL (e.g., Render, Railway, Heroku)
export const host = process.env.NODE_ENV === "production" 
    ? "https://your-backend-api-url.onrender.com" 
    : "http://localhost:5000";

// Auth & User Routes
export const loginRoute = `${host}/api/auth/login`;
export const registerRoute = `${host}/api/auth/register`;
export const logoutRoute = `${host}/api/auth/logout`;
export const allUsersRoute = `${host}/api/auth/allusers`;
export const setAvatarRoute = `${host}/api/auth/setavatar`;
export const updateProfileRoute = `${host}/api/auth/updateprofile`;

// Message Routes
export const sendMessageRoute = `${host}/api/messages/addmsg`;
export const receiveMessageRoute = `${host}/api/messages/getmsg`;
export const reactMessageRoute = `${host}/api/messages/react`;
export const deleteMessageRoute = `${host}/api/messages/deletemsg`;
export const deleteMessageForMeRoute = `${host}/api/messages/deletemsgforme`; 
export const editMessageRoute = `${host}/api/messages/editmsg`;
export const searchMessageRoute = `${host}/api/messages/search`; 

// Group Routes
export const createGroupRoute = `${host}/api/groups/create`;
export const getUserGroupsRoute = `${host}/api/groups/getgroups`;
export const getGroupMessagesRoute = `${host}/api/groups/getmessages`;
export const addGroupMemberRoute = `${host}/api/groups/addmember`;
export const removeGroupMemberRoute = `${host}/api/groups/removemember`;

// Security & Advanced Feature Routes
export const blockUserRoute = `${host}/api/auth/block`;          
export const fcmTokenRoute = `${host}/api/auth/fcm-token`;       
export const publicKeyRoute = `${host}/api/auth/public-key`;     
export const getChatMediaRoute = `${host}/api/messages/getmedia`;
export const updateFcmTokenRoute = `${host}/api/auth/update-fcm`;
export const addStoryRoute = `${host}/api/stories/add`;
export const getStoryFeedRoute = `${host}/api/stories/feed`;
export const viewStoryRoute = `${host}/api/stories/view`;
export const getUserByIdRoute = `${host}/api/auth/user`;
export const updateChatCustomizationRoute = `${host}/api/auth/chat-customization`;
export const createChannelRoute = `${host}/api/groups/channel/create`;
export const searchChannelsRoute = `${host}/api/groups/channel/search`;
export const joinChannelRoute = `${host}/api/groups/channel/join`;
export const getQuickRepliesRoute = `${host}/api/ai/quick-replies`;
export const translateMessageRoute = `${host}/api/ai/translate`;
export const promoteToModeratorRoute = `${host}/api/groups/promoteToModerator`;
export const demoteModeratorRoute = `${host}/api/groups/demoteModerator`;
export const promoteToAdminRoute = `${host}/api/groups/promoteToAdmin`;
export const kickMemberRoute = `${host}/api/groups/kickMember`;
