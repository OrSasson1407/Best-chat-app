const { 
  addMessage, 
  getMessages, 
  reactToMessage,
  deleteMessage,
  editMessage,
  searchMessages 
} = require("../controllers/messageController");
const auth = require("../middleware/authMiddleware"); // Security Middleware
const router = require("express").Router();

// Protected Routes
router.post("/addmsg/", auth, addMessage);
router.post("/getmsg/", auth, getMessages);

// Feature Routes
router.post("/react", auth, reactToMessage);
router.post("/deletemsg", auth, deleteMessage);
router.post("/editmsg", auth, editMessage);

// NEW: Search Route
router.post("/search", auth, searchMessages);

module.exports = router;