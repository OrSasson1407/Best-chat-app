const Story = require('../models/Story');
const logger = require('../utils/logger');

class StoryService {
  async createStory(userId, mediaUrl, mediaType = 'image') {
    try {
      const story = new Story({
        user: userId,
        mediaUrl,
        mediaType,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      return await story.save();
    } catch (error) {
      logger.error(`StoryService create error: ${error.message}`);
      throw new Error('Failed to create story');
    }
  }

  async getActiveStories(userIds) {
    try {
      const now = new Date();
      return await Story.find({
        user: { $in: userIds },
        expiresAt: { $gt: now }
      }).populate('user', 'username avatar').sort({ createdAt: -1 });
    } catch (error) {
      logger.error(`StoryService fetch error: ${error.message}`);
      throw new Error('Failed to fetch stories');
    }
  }
}

module.exports = new StoryService();
