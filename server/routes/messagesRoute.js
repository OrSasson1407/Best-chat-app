const express = require("express");
const { 
  addMessage, 
  getMessages, 
  reactToMessage,
  deleteMessage,
  deleteMessageForMe,
  editMessage,
  searchMessages,
  getChatMedia,
  votePoll,
  triggerViewOnce,
  toggleStarMessage
} = require("../controllers/messageController");
const auth = require("../middleware/authMiddleware"); // Security Middleware

const router = express.Router();

// Protected Message Fetching Routes
router.post("/getmsg/", auth, getMessages);
router.post("/search", auth, searchMessages);
router.post("/getmedia", auth, getChatMedia);

// Message Action Routes
router.post("/addmsg/", auth, addMessage);
router.post("/react", auth, reactToMessage);
router.post("/editmsg", auth, editMessage);

// Message Deletion Routes
router.post("/deletemsg", auth, deleteMessage);
router.post("/deletemsgforme", auth, deleteMessageForMe);

// Specialized Interaction Routes
router.post("/vote", auth, votePoll);
router.post("/viewonce", auth, triggerViewOnce);
router.post("/star", auth, toggleStarMessage);

module.exports = router;