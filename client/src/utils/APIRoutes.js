export const host = "http://localhost:3001";

export const registerRoute = `${host}/api/auth/register`;
export const loginRoute = `${host}/api/auth/login`;

// FIX: This must match the backend route above
export const allUsersRoute = `${host}/api/auth/allusers`; 

export const sendMessageRoute = `${host}/api/messages/addmsg`;
export const receiveMessageRoute = `${host}/api/messages/getmsg`;