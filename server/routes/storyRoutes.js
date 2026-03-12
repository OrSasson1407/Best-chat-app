const router = require("express").Router();
const { addStory, getFeed, viewStory } = require("../controllers/storyController");
const verifyToken = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/errorMiddleware");
const Joi = require("joi");

// --- REQUEST VALIDATION SCHEMAS ---
const addStorySchema = Joi.object({
    // Optional because a story could just be text
    mediaUrl: Joi.string().allow("").optional(), 
    // Must be one of these exactly
    mediaType: Joi.string().valid("image", "video", "text").required(), 
    // Optional text overlay or text-only story
    textContent: Joi.string().allow("").optional(),
    // Optional background color for text stories
    backgroundColor: Joi.string().allow("").optional()
});

// --- ROUTES ---

// All story routes are protected by JWT
// The /add route is additionally protected by strict Joi validation
router.post("/add", verifyToken, validateRequest(addStorySchema), addStory);

router.get("/feed", verifyToken, getFeed);

// Notice no body validation here, just URL param (storyId)
router.post("/view/:storyId", verifyToken, viewStory);

module.exports = router;