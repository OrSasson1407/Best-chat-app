const messageService = require('../../services/messageService');
const logger = require('../../utils/logger');

module.exports = (io, socket) => {
  socket.on('sendMessage', async (payload, callback) => {
    try {
      const { groupId, content, type } = payload;
      
      // 🔥 High Impact: Standardize ID checking and add strict try/catch to prevent silent socket crashes
      const senderId = socket.user?._id || socket.userId; 
      if (!senderId) throw new Error('Unauthorized socket connection');

      const savedMessage = await messageService.saveMessage(senderId, groupId, content, type);
      io.to(groupId).emit('newMessage', savedMessage);

      if (callback) callback({ success: true, data: savedMessage });
    } catch (error) {
      logger.error(`Socket sendMessage error: ${error.message}`);
      // Send error back to client so it can trigger the rollback timeout early if needed
      if (callback) callback({ success: false, error: 'Failed to send message' });
    }
  });
};
