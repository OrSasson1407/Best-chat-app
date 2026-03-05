export const host = "http://localhost:5000";

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
export const editMessageRoute = `${host}/api/messages/editmsg`;
export const searchMessageRoute = `${host}/api/messages/search`; // NEW: Search messages

// Group Routes
export const createGroupRoute = `${host}/api/groups/create`;
export const getUserGroupsRoute = `${host}/api/groups/getgroups`;
export const getGroupMessagesRoute = `${host}/api/groups/getmessages`;
export const addGroupMemberRoute = `${host}/api/groups/addmember`;
export const removeGroupMemberRoute = `${host}/api/groups/removemember`;

// Security & Advanced Feature Routes
export const blockUserRoute = `${host}/api/auth/block`;          // NEW: Block/Unblock users
export const fcmTokenRoute = `${host}/api/auth/fcm-token`;       // NEW: Push notification tokens
export const publicKeyRoute = `${host}/api/auth/public-key`;     // NEW: E2EE Public Key exchange