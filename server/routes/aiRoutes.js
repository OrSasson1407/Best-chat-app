// server/routes/aiRoutes.js
const { generateQuickReplies, translateMessage } = require("../controllers/aiController");
const verifyToken = require("../middleware/authMiddleware");
const router = require("express").Router();

router.post("/quick-replies", verifyToken, generateQuickReplies);
router.post("/translate", verifyToken, translateMessage);

module.exports = router;