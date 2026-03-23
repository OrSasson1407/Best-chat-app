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
router.get("/logout", logout);
router.post("/refresh", refreshToken); // ✅ FIX: was missing — every 15-min expiry caused a full logout instead of a silent token renewal

// Protected routes (require valid access token)
router.get("/allusers/:id", auth, getAllUsers);
router.post("/updateprofile/:id", auth, updateProfile);
router.post("/block", auth, toggleBlockUser);
router.post("/update-fcm", auth, updateFcmToken);
router.post("/chat-customization", auth, updateChatCustomization);
router.get("/user/:id", auth, getUserById);

// E2E Encryption routes
router.post("/e2e-keys", updateE2EKeys);
router.get("/public-key/:id", getPublicKey);

module.exports = router;