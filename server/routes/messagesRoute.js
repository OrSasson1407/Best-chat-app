const { addMessage, getMessages, reactToMessage } = require("../controllers/messageController");
const router = require("express").Router();

router.post("/addmsg/", addMessage);
router.post("/getmsg/", getMessages);

// NEW: The reaction route
router.post("/react", reactToMessage);

module.exports = router;