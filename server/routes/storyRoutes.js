// server/routes/storyRoutes.js
const router = require("express").Router();
const { addStory, getFeed, viewStory } = require("../controllers/storyController");
const verifyToken = require("../middleware/authMiddleware");

// All story routes are protected
router.post("/add", verifyToken, addStory);
router.get("/feed", verifyToken, getFeed);
router.post("/view/:storyId", verifyToken, viewStory);

module.exports = router;