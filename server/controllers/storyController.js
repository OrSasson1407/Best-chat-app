// server/controllers/storyController.js
const Story = require("../models/Story");
const User = require("../models/User");

// Add a new status/story
exports.addStory = async (req, res, next) => {
  try {
    const { mediaUrl, mediaType, textContent, backgroundColor } = req.body;
    const userId = req.user.id; // Assuming verifyToken middleware sets req.user

    const newStory = await Story.create({
      user: userId,
      mediaUrl,
      mediaType,
      textContent,
      backgroundColor,
    });

    // Emit via Socket.io to notify online users about the new story
    const io = req.app.get("io");
    if (io) {
       // In a real scenario, you'd only broadcast to the user's contacts. 
       // For now, we broadcast globally or you can map it to online contacts.
       io.emit("new-story-published", { userId, storyId: newStory._id });
    }

    return res.status(201).json({ status: true, story: newStory });
  } catch (error) {
    next(error);
  }
};

// Get active stories from the user and their contacts
exports.getFeed = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // Fetch all active stories (MongoDB TTL handles removing old ones)
    // In a fully scaled app, you'd filter this by `req.user.contacts`
    const stories = await Story.find()
      .populate("user", "username avatarImage")
      .sort({ createdAt: -1 });

    // Group stories by user for the UI (like Instagram/WhatsApp rings)
    const groupedStories = stories.reduce((acc, story) => {
      const userIdStr = story.user._id.toString();
      if (!acc[userIdStr]) {
        acc[userIdStr] = {
          user: story.user,
          stories: [],
        };
      }
      acc[userIdStr].stories.push(story);
      return acc;
    }, {});

    return res.status(200).json({ status: true, feed: Object.values(groupedStories) });
  } catch (error) {
    next(error);
  }
};

// Mark a story as viewed
exports.viewStory = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ msg: "Story not found" });

    // Prevent duplicate views from the same user
    const hasViewed = story.viewers.some(v => v.userId.toString() === userId);
    if (!hasViewed && story.user.toString() !== userId) {
      story.viewers.push({ userId });
      await story.save();
    }

    return res.status(200).json({ status: true });
  } catch (error) {
    next(error);
  }
};