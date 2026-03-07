const { 
  addMessage, 
  getMessages, 
  reactToMessage,
  deleteMessage,
  deleteMessageForMe, // <-- MERGE UPDATE: Imported new controller function
  editMessage,
  searchMessages,
  getChatMedia 
} = require("../controllers/messageController");
const auth = require("../middleware/authMiddleware"); // Security Middleware
const router = require("express").Router();

// Protected Routes
router.post("/addmsg/", auth, addMessage);
router.post("/getmsg/", auth, getMessages);

// Feature Routes
router.post("/react", auth, reactToMessage);
router.post("/deletemsg", auth, deleteMessage);
router.post("/deletemsgforme", auth, deleteMessageForMe); // <-- MERGE UPDATE: New route for local deletion
router.post("/editmsg", auth, editMessage);

// NEW: Search Route
router.post("/search", auth, searchMessages);

// NEW: Media Gallery Route
router.post("/getmedia", auth, getChatMedia);

module.exports = router;