// server/routes/aiRoutes.js
const { generateQuickReplies, translateMessage, summarizeChat } = require("../controllers/aiController");
const verifyToken = require("../middleware/authMiddleware");
const router = require("express").Router();

router.post("/quick-replies", verifyToken, generateQuickReplies);
router.post("/translate", verifyToken, translateMessage);

// NEW: Route for catching up on missed messages
router.post("/summarize", verifyToken, summarizeChat); 

module.exports = router;