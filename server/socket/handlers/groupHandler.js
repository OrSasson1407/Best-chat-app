const logger = require('../../utils/logger');

module.exports = (io, socket) => {
  // Join a specific group room for real-time updates
  socket.on('joinGroup', (groupId, callback) => {
    try {
      socket.join(groupId);
      logger.info(`User ${socket.user?._id || socket.id} joined group room: ${groupId}`);
      if (callback) callback({ success: true });
    } catch (error) {
      logger.error(`Socket joinGroup error: ${error.message}`);
      if (callback) callback({ success: false, error: 'Failed to join group room' });
    }
  });

  // Leave a specific group room
  socket.on('leaveGroup', (groupId, callback) => {
    try {
      socket.leave(groupId);
      logger.info(`User ${socket.user?._id || socket.id} left group room: ${groupId}`);
      if (callback) callback({ success: true });
    } catch (error) {
      logger.error(`Socket leaveGroup error: ${error.message}`);
      if (callback) callback({ success: false, error: 'Failed to leave group room' });
    }
  });
};
