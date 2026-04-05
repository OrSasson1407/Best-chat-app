const {
  generateQuickReplies,
  translateMessage,
  summarizeChat,
  grammarCheck,
} = require("../controllers/aiController");

const verifyToken = require("../middleware/authMiddleware");
const router = require("express").Router();

router.post("/quick-replies", verifyToken, generateQuickReplies);
router.post("/translate", verifyToken, translateMessage);
router.post("/summarize", verifyToken, summarizeChat);

// Sprint 1 — Grammar & Spell Check
router.post("/grammar-check", verifyToken, grammarCheck);

module.exports = router;