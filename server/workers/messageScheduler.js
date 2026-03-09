const Message = require("../models/Message");
const logger = require("../utils/logger");

const startMessageScheduler = () => {
  // Use environment variable for scheduler interval, default to 30s
  const intervalMs = process.env.SCHEDULER_INTERVAL_MS || 30000;

  setInterval(async () => {
    try {
      const now = new Date();
      
      const pendingMessages = await Message.find({
        isSent: false,
        scheduledAt: { $lte: now }
      });

      if (pendingMessages.length > 0) {
        for (let msg of pendingMessages) {
          msg.isSent = true;
          msg.status = "sent";
          await msg.save();

          if (global.chatSocket && global.onlineUsers) {
            const targetUsers = msg.users.filter(id => id.toString() !== msg.sender.toString());
            
            targetUsers.forEach(targetId => {
              const receiverSocket = global.onlineUsers.get(targetId.toString());
              
              if (receiverSocket) {
                global.chatSocket.to(receiverSocket).emit("msg-recieve", {
                  id: msg._id.toString(),
                  from: msg.sender.toString(),
                  to: targetId.toString(),
                  msg: msg.message?.text || msg.message.text, 
                  type: msg.type,
                  createdAt: msg.createdAt,
                  timer: msg.timer,
                  isViewOnce: msg.isViewOnce,
                  isForwarded: msg.isForwarded,
                  pollData: msg.pollData,
                  linkMetadata: msg.linkMetadata,
                  isGroup: msg.users.length > 2 
                });
              }
            });
          }
        }
        logger.info(`[Scheduler] Processed and sent ${pendingMessages.length} scheduled message(s).`);
      }
    } catch (err) {
      logger.error(`[Scheduler Error]: ${err.message}`);
    }
  }, intervalMs);
};

module.exports = startMessageScheduler;