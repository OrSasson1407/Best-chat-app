const {
  register,
  login,
  logout,
  refreshToken,
  getAllUsers,
  updateProfile,
  toggleBlockUser,
  updateFcmToken,
  updateE2EKeys,
  getPublicKey,
  getUserById,
  updateChatCustomization,
  // Sprint 1
  setup2FA,
  verify2FA,
  validate2FALogin,
  disable2FA,
  archiveChat,
} = require("../controllers/authController");

const auth = require("../middleware/authMiddleware");
const router = require("express").Router();

// Public routes (no token required)
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

// Protected routes
router.get("/allusers/:id", auth, getAllUsers);
router.post("/updateprofile/:id", auth, updateProfile);
router.post("/block", auth, toggleBlockUser);
router.post("/update-fcm", auth, updateFcmToken);
router.post("/chat-customization", auth, updateChatCustomization);
router.get("/user/:id", auth, getUserById);

// E2E Encryption routes
router.post("/e2e-keys", auth, updateE2EKeys);
router.get("/public-key/:id", getPublicKey);

// Sprint 1 — 2FA routes
router.post("/2fa/setup", auth, setup2FA);
router.post("/2fa/verify", auth, verify2FA);
router.post("/2fa/validate", validate2FALogin); // public — called before token is issued
router.post("/2fa/disable", auth, disable2FA);

// Sprint 1 — Archive chat
router.post("/archive-chat", auth, archiveChat);

module.exports = router;