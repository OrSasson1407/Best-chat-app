const Message = require('../models/Message');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

class MessageService {
  async getMessagesByGroup(groupId, page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;
      const cacheKey = `messages:${groupId}:page:${page}`;
      
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const messages = await Message.find({ groupId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'username avatar');

      await redisClient.setEx(cacheKey, 60, JSON.stringify(messages));
      return messages;
    } catch (error) {
      logger.error(`Error in getMessagesByGroup: ${error.message}`);
      throw new Error('Failed to retrieve messages');
    }
  }

  async saveMessage(senderId, groupId, content, type = 'text') {
    try {
      const newMessage = new Message({
        senderId,
        groupId,
        content,
        type,
        status: 'sent'
      });

      const savedMessage = await newMessage.save();
      await redisClient.del(`messages:${groupId}:page:1`);
      return savedMessage;
    } catch (error) {
      logger.error(`Error in saveMessage: ${error.message}`);
      throw new Error('Failed to save message');
    }
  }
}

module.exports = new MessageService();
