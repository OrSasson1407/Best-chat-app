const { 
  register, 
  login, 
  getAllUsers, 
  updateProfile, 
  toggleBlockUser, 
  updateFcmToken, 
  updatePublicKey, 
  getPublicKey 
} = require("../controllers/authController");

const auth = require("../middleware/authMiddleware"); // Import the security middleware
const router = require("express").Router();

// Public Routes (No token required to join or sign in)
router.post("/register", register);
router.post("/login", login);

// Protected User & Profile Routes (Token Required)
router.get("/allusers/:id", auth, getAllUsers);
router.post("/updateprofile/:id", auth, updateProfile);

// Security & Advanced Feature Routes (Token Required)
// These power the new features we added to the ChatContainer
router.post("/block", auth, toggleBlockUser);
router.post("/fcm-token", auth, updateFcmToken);
router.post("/public-key", auth, updatePublicKey);
router.get("/public-key/:id", auth, getPublicKey);

module.exports = router;