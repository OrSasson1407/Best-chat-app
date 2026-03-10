const { 
  register, 
  login, 
  logout, 
  getAllUsers, 
  updateProfile, 
  toggleBlockUser, 
  updateFcmToken, 
  updatePublicKey, 
  getPublicKey,
  getUserById,
  updateChatCustomization
} = require("../controllers/authController");

const auth = require("../middleware/authMiddleware");
const router = require("express").Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and User Management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               gender:
 *                 type: string
 *                 description: male or female
 *               avatarImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully registered and returned tokens
 *       400:
 *         description: Validation error or user already exists
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login an existing user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully logged in and returned tokens
 *       400:
 *         description: Incorrect Username or Password
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/logout:
 *   get:
 *     summary: Log out user and clear refresh token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Successfully logged out and cookie cleared
 */
router.get("/logout", logout);

/**
 * @swagger
 * /api/auth/allusers/{id}:
 *   get:
 *     summary: Get all users except the current user
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The current user's ID
 *     responses:
 *       200:
 *         description: A list of users
 *       401:
 *         description: Unauthorized
 */
router.get("/allusers/:id", auth, getAllUsers);

/**
 * @swagger
 * /api/auth/updateprofile/{id}:
 *   post:
 *     summary: Update user profile details
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user's ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               statusMessage:
 *                 type: string
 *               statusIcon:
 *                 type: string
 *               bio:
 *                 type: string
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.post("/updateprofile/:id", auth, updateProfile);

/**
 * @swagger
 * /api/auth/block:
 *   post:
 *     summary: Toggle blocking/unblocking a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - blockedUserId
 *             properties:
 *               userId:
 *                 type: string
 *               blockedUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully toggled block status
 */
router.post("/block", auth, toggleBlockUser);

/**
 * @swagger
 * /api/auth/update-fcm:
 *   post:
 *     summary: Update Firebase Cloud Messaging (FCM) token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - fcmToken
 *             properties:
 *               userId:
 *                 type: string
 *               fcmToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: FCM Token updated successfully
 */
router.post("/update-fcm", auth, updateFcmToken);

/**
 * @swagger
 * /api/auth/public-key:
 *   post:
 *     summary: Register a public key for End-to-End Encryption
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - publicKey
 *             properties:
 *               userId:
 *                 type: string
 *               publicKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Public Key registered
 */
router.post("/public-key", updatePublicKey);

/**
 * @swagger
 * /api/auth/public-key/{id}:
 *   get:
 *     summary: Get a user's public key for E2EE
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The target user's ID
 *     responses:
 *       200:
 *         description: Returns the requested public key
 */
router.get("/public-key/:id", getPublicKey);

/**
 * @swagger
 * /api/auth/user/{id}:
 *   get:
 *     summary: Get user details by ID for QR scanning
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The scanned user's ID
 *     responses:
 *       200:
 *         description: Returns the user details
 *       404:
 *         description: User not found
 */
router.get("/user/:id", auth, getUserById);

/**
 * @swagger
 * /api/auth/chat-customization:
 *   post:
 *     summary: Update wallpaper and theme color for a specific chat
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - chatId
 *             properties:
 *               userId:
 *                 type: string
 *               chatId:
 *                 type: string
 *               wallpaper:
 *                 type: string
 *               themeColor:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customizations saved successfully
 */
router.post("/chat-customization", auth, updateChatCustomization);

module.exports = router;