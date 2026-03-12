/**
 * Scheduled Message Worker
 * --------------------------------------------------------
 * This worker periodically checks the database for messages
 * that were scheduled to be sent in the future and dispatches
 * them when their scheduled time arrives.
 *
 * Features:
 * - Cron-like background job using setInterval
 * - Fetches pending scheduled messages from MongoDB
 * - Marks messages as sent
 * - Emits real-time events via Socket.io using Redis state (NEW)
 * - Enqueues push notifications for offline users
 * - Supports:
 * • private chats
 * • group chats
 * • polls
 * • link previews
 * • view-once messages
 * • forwarded messages
 *
 * This worker runs continuously after the server starts.
 */

const Message = require("../models/Message"); // MongoDB message model
const User = require("../models/User"); // Required to get FCM tokens for offline users
const logger = require("../utils/logger"); // Central logging utility
const { notificationQueue } = require("./notificationWorker"); // Notification queue

/**
 * Initializes the scheduled message worker.
 *
 * @param {SocketIO.Server} io - Socket.io server instance to emit events
 * @param {RedisClient} redisClient - Connected Redis client to find online sockets
 */
const startMessageScheduler = (io, redisClient) => {

  /**
   * Scheduler interval (how often the worker runs)
   * Default: 30 seconds
   * Configurable via environment variable.
   */
  const intervalMs = process.env.SCHEDULER_INTERVAL_MS || 30000;

  /**
   * Main worker loop
   * Runs every X milliseconds
   */
  setInterval(async () => {

    try {

      const now = new Date();

      /**
       * Query database for pending scheduled messages
       */
      const pendingMessages = await Message.find({
        isSent: false,
        scheduledAt: { $lte: now }
      });

      /**
       * Process messages if any are found
       */
      if (pendingMessages.length > 0) {

        for (let msg of pendingMessages) {

          /**
           * Update message status
           */
          msg.isSent = true;
          msg.status = "sent";

          await msg.save();

          /**
           * Emit real-time event if socket system is available
           */
          if (io && redisClient) {

            /**
             * Determine target recipients
             * Exclude sender from recipients list
             */
            const targetUsers = msg.users.filter(
              id => id.toString() !== msg.sender.toString()
            );

            /**
             * Deliver message to each recipient
             */
            for (let targetId of targetUsers) {

              /**
               * Retrieve the recipient's socket ID from Redis
               */
              const receiverSocket = await redisClient.hGet("online_users", targetId.toString());

              /**
               * If recipient is online, emit the message
               */
              if (receiverSocket) {

                io
                  .to(receiverSocket)
                  .emit("msg-recieve", {

                    id: msg._id.toString(),
                    from: msg.sender.toString(),
                    to: targetId.toString(),

                    // Message content
                    msg: msg.message?.text || msg.message.text,

                    // Message metadata
                    type: msg.type,
                    createdAt: msg.createdAt,
                    timer: msg.timer,
                    isViewOnce: msg.isViewOnce,
                    isForwarded: msg.isForwarded,

                    // Optional message types
                    pollData: msg.pollData,
                    linkMetadata: msg.linkMetadata,

                    // Determine if message belongs to group chat
                    isGroup: msg.users.length > 2
                  });
                  
              } else {
                
                /**
                 * If recipient is offline, send a push notification instead
                 */
                const offlineUser = await User.findById(targetId.toString());
                
                if (offlineUser && offlineUser.fcmToken) {
                  await notificationQueue.add("send_fcm_message", {
                    userId: targetId.toString(),
                    fcmToken: offlineUser.fcmToken,
                    title: "New Scheduled Message",
                    body: msg.message?.text || msg.message.text || "You received a new message"
                  });
                }

              }
            }
          }
        }

        /**
         * Log scheduler activity
         */
        logger.info(
          `[Scheduler] Processed and sent ${pendingMessages.length} scheduled message(s).`
        );
      }

    } catch (err) {

      /**
       * Error handling
       */
      logger.error(`[Scheduler Error]: ${err.message}`);

    }

  }, intervalMs);
};

/**
 * Export worker initializer
 */
module.exports = startMessageScheduler;