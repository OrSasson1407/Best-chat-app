export const host = "http://localhost:5000";
export const loginRoute = `${host}/api/auth/login`;
export const registerRoute = `${host}/api/auth/register`;
export const logoutRoute = `${host}/api/auth/logout`;
export const allUsersRoute = `${host}/api/auth/allusers`;
export const sendMessageRoute = `${host}/api/messages/addmsg`;
export const receiveMessageRoute = `${host}/api/messages/getmsg`;
export const setAvatarRoute = `${host}/api/auth/setavatar`;

// Added route for emoji reactions
export const reactMessageRoute = `${host}/api/messages/react`;

// Routes for Edit and Delete
export const deleteMessageRoute = `${host}/api/messages/deletemsg`;
export const editMessageRoute = `${host}/api/messages/editmsg`;

// Group Routes
export const createGroupRoute = `${host}/api/groups/create`;
export const getUserGroupsRoute = `${host}/api/groups/getgroups`;
export const getGroupMessagesRoute = `${host}/api/groups/getmessages`;
export const addGroupMemberRoute = `${host}/api/groups/addmember`;
export const removeGroupMemberRoute = `${host}/api/groups/removemember`;

// NEW: Profile Update Route
export const updateProfileRoute = `${host}/api/auth/updateprofile`;