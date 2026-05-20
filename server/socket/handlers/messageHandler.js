const messageService = require('../../services/messageService');
const logger = require('../../utils/logger');

module.exports = (io, socket) => {
  socket.on('sendMessage', async (payload, callback) => {
    try {
      const { groupId, content, type } = payload;
      // Socket authentication middleware should populate socket.user
      const senderId = socket.user._id; 

      // 1. Save via service layer
      const savedMessage = await messageService.saveMessage(senderId, groupId, content, type);

      // 2. Broadcast to the specific group room
      io.to(groupId).emit('newMessage', savedMessage);

      // 3. Acknowledge success to the sender
      if (callback) callback({ success: true, data: savedMessage });
    } catch (error) {
      logger.error(`Socket sendMessage error: ${error.message}`);
      if (callback) callback({ success: false, error: 'Failed to send message' });
    }
  });
};
