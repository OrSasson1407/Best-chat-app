const Story = require("../models/Story");

class StoryService {
  
  // Custom error thrower to keep HTTP status codes intact
  throwError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  }

  async addStory(data, userId) {
    const { mediaUrl, mediaType, textContent, backgroundColor } = data;
    
    const newStory = await Story.create({
      user: userId,
      mediaUrl,
      mediaType,
      textContent,
      backgroundColor,
    });
    
    return newStory;
  }

  async getFeed(currentUserId) {
    // Fetch all active stories (MongoDB TTL handles removing old ones automatically)
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

    return Object.values(groupedStories);
  }

  async viewStory(storyId, userId) {
    const story = await Story.findById(storyId);
    if (!story) this.throwError(404, "Story not found");

    // Prevent duplicate views from the same user
    const hasViewed = story.viewers.some(v => v.userId.toString() === userId);
    if (!hasViewed && story.user.toString() !== userId) {
      story.viewers.push({ userId });
      await story.save();
    }
    
    return story;
  }
}

module.exports = new StoryService();