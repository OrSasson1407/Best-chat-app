const {
  generateQuickReplies,
  translateMessage,
  summarizeChat,
  grammarCheck,
  toneCheck,   // Sprint 2
} = require("../controllers/aiController");

const verifyToken = require("../middleware/authMiddleware");
const router = require("express").Router();

router.post("/quick-replies",  verifyToken, generateQuickReplies);
router.post("/translate",      verifyToken, translateMessage);
router.post("/summarize",      verifyToken, summarizeChat);
router.post("/grammar-check",  verifyToken, grammarCheck);  // Sprint 1
router.post("/tone-check",     verifyToken, toneCheck);     // Sprint 2

module.exports = router;