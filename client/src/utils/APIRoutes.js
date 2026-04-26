/**
 * API Routes Configuration
 * ------------------------------------------------
 * Centralizes all backend API endpoints..
 */

export const host = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV
    ? "http://localhost:5000"
    : "https://best-chat-app.onrender.com"
);

// ── Auth & User ───────────────────────────────────────────────────────────────
export const loginRoute              = `${host}/api/auth/login`;
export const registerRoute           = `${host}/api/auth/register`;
export const logoutRoute             = `${host}/api/auth/logout`;
export const refreshTokenRoute       = `${host}/api/auth/refresh`;
export const allUsersRoute           = `${host}/api/auth/allusers`;
export const setAvatarRoute          = `${host}/api/auth/setavatar`;
export const updateProfileRoute      = `${host}/api/auth/updateprofile`;
export const blockUserRoute          = `${host}/api/auth/block`;
export const getUserByIdRoute        = `${host}/api/auth/user`;
export const fcmTokenRoute           = `${host}/api/auth/fcm-token`;
export const updateFcmTokenRoute     = `${host}/api/auth/update-fcm`;
export const updateChatCustomizationRoute = `${host}/api/auth/chat-customization`;

// ── Messages ──────────────────────────────────────────────────────────────────
export const sendMessageRoute        = `${host}/api/messages/addmsg`;
export const receiveMessageRoute     = `${host}/api/messages/getmsg`;
export const reactMessageRoute       = `${host}/api/messages/react`;
export const deleteMessageRoute      = `${host}/api/messages/deletemsg`;
export const deleteMessageForMeRoute = `${host}/api/messages/deletemsgforme`;
export const editMessageRoute        = `${host}/api/messages/editmsg`;
export const searchMessageRoute      = `${host}/api/messages/search`;
export const getChatMediaRoute       = `${host}/api/messages/getmedia`;

// ── Groups ────────────────────────────────────────────────────────────────────
export const createGroupRoute        = `${host}/api/groups/create`;
export const getUserGroupsRoute      = `${host}/api/groups/getgroups`;
export const getGroupRoute           = `${host}/api/groups`; // GET /api/groups/:id
export const getGroupMessagesRoute   = `${host}/api/groups/getmessages`;
export const addGroupMemberRoute     = `${host}/api/groups/add-member`;
export const removeGroupMemberRoute  = `${host}/api/groups/remove-member`;
// BUG-007 FIX: these routes exist on the server but were missing client-side
export const leaveGroupRoute         = `${host}/api/groups/leave`;   // DELETE /leave/:id
export const deleteGroupRoute        = `${host}/api/groups/delete`;  // DELETE /delete/:id

// ── Channels ──────────────────────────────────────────────────────────────────
export const createChannelRoute      = `${host}/api/groups/createChannel`;
export const searchChannelsRoute     = `${host}/api/groups/searchChannels`;
export const joinChannelRoute        = `${host}/api/groups/joinChannel`;

// ── Admin / Moderation ────────────────────────────────────────────────────────
export const promoteToModeratorRoute = `${host}/api/groups/promoteToModerator`;
export const demoteModeratorRoute    = `${host}/api/groups/demoteModerator`;
export const promoteToAdminRoute     = `${host}/api/groups/promoteToAdmin`;
export const kickMemberRoute         = `${host}/api/groups/kickMember`;

// ── Stories ───────────────────────────────────────────────────────────────────
export const addStoryRoute           = `${host}/api/stories/add`;
export const getStoryFeedRoute       = `${host}/api/stories/feed`;
export const viewStoryRoute          = `${host}/api/stories/view`;

// ── AI ────────────────────────────────────────────────────────────────────────
export const getQuickRepliesRoute    = `${host}/api/ai/quick-replies`;
export const translateMessageRoute   = `${host}/api/ai/translate`;
export const summarizeChatRoute      = `${host}/api/ai/summarize`;
export const grammarCheckRoute       = `${host}/api/ai/grammar-check`;   // Sprint 1
export const toneCheckRoute          = `${host}/api/ai/tone-check`;      // Sprint 2

// ── E2E Encryption ────────────────────────────────────────────────────────────
export const publicKeyRoute          = `${host}/api/e2e/bundle`;
export const updateE2EKeysRoute      = `${host}/api/e2e/upload-bundle`;

// ── Sprint 1 ──────────────────────────────────────────────────────────────────
export const setup2FARoute           = `${host}/api/auth/2fa/setup`;
export const verify2FARoute          = `${host}/api/auth/2fa/verify`;
export const validate2FALoginRoute   = `${host}/api/auth/2fa/validate`;
export const disable2FARoute         = `${host}/api/auth/2fa/disable`;
export const archiveChatRoute        = `${host}/api/auth/archive-chat`;

// ── Sprint 2 ──────────────────────────────────────────────────────────────────
export const sendFriendRequestRoute    = `${host}/api/auth/friends/request`;
export const respondFriendRequestRoute = `${host}/api/auth/friends/respond`;
export const getFriendRequestsRoute    = `${host}/api/auth/friends/requests`;
export const muteChatRoute             = `${host}/api/auth/mute-chat`;
export const saveChatFolderRoute       = `${host}/api/auth/folders/save`;
export const deleteChatFolderRoute     = `${host}/api/auth/folders/delete`;
export const toggleChatInFolderRoute   = `${host}/api/auth/folders/toggle`;

// ── Sprint 3 ──────────────────────────────────────────────────────────────────
// Onboarding
export const completeOnboardingRoute   = `${host}/api/auth/onboarding/complete`;

// QR code — profile share
export const profileQRDataRoute        = `${host}/api/auth/qr-data`;

// Group rules
export const setGroupRulesRoute        = `${host}/api/groups/set-rules`;

// Max member limit
export const setMaxMembersRoute        = `${host}/api/groups/set-max-members`;

// Group invite QR / code
export const getGroupInviteCodeRoute   = `${host}/api/groups/invite-code`; // + /:groupId
export const joinViaInviteCodeRoute    = `${host}/api/groups/join-via-code`;