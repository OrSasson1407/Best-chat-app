const { 
  addMessage, 
  getMessages, 
  reactToMessage,
  deleteMessage,
  editMessage 
} = require("../controllers/messageController");
const router = require("express").Router();

router.post("/addmsg/", addMessage);
router.post("/getmsg/", getMessages);

// The reaction route
router.post("/react", reactToMessage);

// NEW: Routes for Edit and Delete
router.post("/deletemsg", deleteMessage);
router.post("/editmsg", editMessage);

module.exports = router;