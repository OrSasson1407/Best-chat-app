const { 
  register, 
  login, 
  logout, 
  getAllUsers, 
  updateProfile, 
  toggleBlockUser, 
  updateFcmToken, 
  updateE2EKeys,  // FIX: Replaced updatePublicKey with updateE2EKeys
  getPublicKey,
  getUserById,
  updateChatCustomization
} = require("../controllers/authController");

const auth = require("../middleware/authMiddleware");
const router = require("express").Router();

/**
 * @swagger
 * tags:
 * - name: Auth
 * description: Authentication and User Management
 */

router.post("/register", register);
router.post("/login", login);
router.get("/logout", logout);
router.get("/allusers/:id", auth, getAllUsers);
router.post("/updateprofile/:id", auth, updateProfile);
router.post("/block", auth, toggleBlockUser);
router.post("/update-fcm", auth, updateFcmToken);

/**
 * @swagger
 * /api/auth/e2e-keys:
 * post:
 * summary: Register a full E2E Keys bundle
 * tags: [Auth]
 */
router.post("/e2e-keys", updateE2EKeys); // FIX: Exposed the new POST endpoint for bundles

/**
 * @swagger
 * /api/auth/public-key/{id}:
 * get:
 * summary: Get a user's E2E keys bundle
 * tags: [Auth]
 */
router.get("/public-key/:id", getPublicKey); // Kept the same GET path so the frontend fetches it normally

router.get("/user/:id", auth, getUserById);
router.post("/chat-customization", auth, updateChatCustomization);

module.exports = router;