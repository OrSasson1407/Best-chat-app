const {
  register, login, logout, refreshToken,
  getAllUsers, updateProfile, toggleBlockUser,
  updateFcmToken, updateE2EKeys, getPublicKey,
  getUserById, updateChatCustomization,
  // Sprint 1
  setup2FA, verify2FA, validate2FALogin, disable2FA, archiveChat,
  // Sprint 2
  sendFriendRequest, respondFriendRequest, getFriendRequests,
  muteChat,
  saveChatFolder, deleteChatFolder, toggleChatInFolder,
  // Sprint 3
  completeOnboarding, getProfileQRData,
} = require("../controllers/authController");

const auth = require("../middleware/authMiddleware");
const router = require("express").Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

// ── Sprint 1: 2FA (validate is public) ───────────────────────────────────────
router.post("/2fa/validate", validate2FALogin);

// ── Protected ─────────────────────────────────────────────────────────────────
router.get("/allusers/:id",        auth, getAllUsers);
router.post("/updateprofile/:id",  auth, updateProfile);
router.post("/block",              auth, toggleBlockUser);
router.post("/update-fcm",         auth, updateFcmToken);
router.post("/chat-customization", auth, updateChatCustomization);
router.get("/user/:id",            auth, getUserById);

// E2E
router.post("/e2e-keys",      auth, updateE2EKeys);
router.get("/public-key/:id", getPublicKey);

// Sprint 1 — 2FA (protected)
router.post("/2fa/setup",   auth, setup2FA);
router.post("/2fa/verify",  auth, verify2FA);
router.post("/2fa/disable", auth, disable2FA);

// Sprint 1 — Archive
router.post("/archive-chat", auth, archiveChat);

// Sprint 2 — Friend system
router.post("/friends/request", auth, sendFriendRequest);
router.post("/friends/respond", auth, respondFriendRequest);
router.get("/friends/requests", auth, getFriendRequests);

// Sprint 2 — Mute
router.post("/mute-chat", auth, muteChat);

// Sprint 2 — Chat folders
router.post("/folders/save",   auth, saveChatFolder);
router.post("/folders/delete", auth, deleteChatFolder);
router.post("/folders/toggle", auth, toggleChatInFolder);

// Sprint 3 — Onboarding
router.post("/onboarding/complete", auth, completeOnboarding);

// Sprint 3 — Profile QR data
router.get("/qr-data", auth, getProfileQRData);

module.exports = router;