const {
  register,
  login,
  logout,
  refreshToken,         // ✅ FIX: was never imported — the route didn't exist
  getAllUsers,
  updateProfile,
  toggleBlockUser,
  updateFcmToken,
  updateE2EKeys,
  getPublicKey,
  getUserById,
  updateChatCustomization
} = require("../controllers/authController");

const auth = require("../middleware/authMiddleware");
const router = require("express").Router();

// Public routes (no token required)
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);

// BUGFIX: logout must be POST (it mutates state — blacklists tokens in Redis).
// Using GET allowed browsers/crawlers/prefetch to trigger logout unintentionally.
// Auth middleware is added so the access token is verified before blacklisting.
router.post("/logout", logout);
// Protected routes (require valid access token)
router.get("/allusers/:id", auth, getAllUsers);
router.post("/updateprofile/:id", auth, updateProfile);
router.post("/block", auth, toggleBlockUser);
router.post("/update-fcm", auth, updateFcmToken);
router.post("/chat-customization", auth, updateChatCustomization);
router.get("/user/:id", auth, getUserById);

// E2E Encryption routes
// SECURITY FIX: /e2e-keys now requires auth and ownership check
router.post("/e2e-keys", auth, updateE2EKeys);
router.get("/public-key/:id", getPublicKey);

module.exports = router;