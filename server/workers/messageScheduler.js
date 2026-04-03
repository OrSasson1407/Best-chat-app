/**
 * Scheduled Message Worker
 * --------------------------------------------------------
 * This worker processes delayed jobs dynamically via BullMQ
 * instead of running a heavy database polling loop.
 *
 * Features:
 * - Precise execution via Redis delays (no setInterval)
 * - Startup recovery for missed messages
 * - Marks messages as sent
 * - Emits real-time events via Socket.io using Redis state
 * - Enqueues push notifications for offline users
 * - Supports private chats, group chats, polls, link previews, etc.
 */

const { Queue, Worker } = require("bullmq");
const Message = require("../models/Message"); // MongoDB message model
const User = require("../models/User"); // Required to get FCM tokens for offline users
const logger = require("../utils/logger"); // Central logging utility
const { notificationQueue } = require("./notificationWorker"); // Notification queue

// Redis connection used by BullMQ
const { bullMQConnection: connection } = require("../config/redis");

// IMPROVEMENT: Queue for scheduling messages. 
// Export this so controllers can push to it with a specific delay.
const scheduledMessageQueue = new Queue("scheduled_messages", { connection });

// CRITICAL FIX: Catch BullMQ Queue background errors
scheduledMessageQueue.on("error", (err) => {
  logger.error(`[BullMQ] scheduledMessageQueue background error: ${err.message}`);
});

/**
 * Initializes the scheduled message worker.
 *
 * @param {SocketIO.Server} io - Socket.io server instance to emit events
 * @param {RedisClient} redisClient - Connected Redis client to find online sockets
 */
const startMessageScheduler = async (io, redisClient) => {

  // =========================================================
  // 1. STARTUP RECOVERY
  // Catch up on any messages missed while the server was down
  // =========================================================
  try {
    const now = new Date();
    const missedMessages = await Message.find({
      isSent: false,
      scheduledAt: { $lte: now }
    });

    for (let msg of missedMessages) {
       // Add to queue with 0 delay so they process immediately
       await scheduledMessageQueue.add("send_scheduled", { messageId: msg._id });
    }

    if (missedMessages.length > 0) {
      logger.info(`[Scheduler] Recovered and queued ${missedMessages.length} missed scheduled message(s).`);
    }
  } catch (err) {
    logger.error(`[Scheduler Recovery Error]: ${err.message}`);
  }

  // =========================================================
  // 2. BULLMQ WORKER
  // Processes messages exactly when their delay expires
  // =========================================================
  const worker = new Worker("scheduled_messages", async (job) => {
    
    const { messageId } = job.data;
    const msg = await Message.findById(messageId);

    // Safety checks: Skip if message was deleted or already sent
    if (!msg || msg.isSent) return;

    try {
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
        
        // Exclude sender from recipients list
        const targetUsers = msg.users.filter(
          id => id.toString() !== msg.sender.toString()
        );

        // Deliver message to each recipient
        for (let targetId of targetUsers) {
          
          // Retrieve the recipient's socket ID from Redis
          const receiverSocket = await redisClient.hGet("online_users", targetId.toString());

          if (receiverSocket) {
            // Recipient is online, emit the message
            io.to(receiverSocket).emit("msg-recieve", {
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
            
          } else {
            // Recipient is offline, send a push notification instead
            // FIX: select fcmTokens (array) — old fcmToken (singular) field no longer exists
            const offlineUser = await User.findById(targetId.toString()).select("fcmTokens");
            
            if (offlineUser && offlineUser.fcmTokens && offlineUser.fcmTokens.length > 0) {
              await notificationQueue.add("send_fcm_message", {
                userId: targetId.toString(),
                fcmTokens: offlineUser.fcmTokens,  // FIX: array, matches notificationWorker
                title: "New Scheduled Message",
                body: msg.message?.text || msg.message.text || "You received a new message"
              });
            }
          }
        }
      }

      logger.info(`[Scheduler] Successfully dispatched scheduled message: ${msg._id}`);
      
    } catch (err) {
      logger.error(`[Scheduler Job Error for ${messageId}]: ${err.message}`);
      throw err; // Throwing allows BullMQ to retry the job if a network/DB glitch occurs
    }

  }, { 
      connection,
      concurrency: 5 // Process up to 5 scheduled messages simultaneously
  });

  // =========================================================
  // 3. WORKER EVENTS
  // =========================================================
  worker.on("failed", (job, err) => {
    logger.error(`[BullMQ] Scheduled Job ${job.id} failed: ${err.message}`);
  });

  // CRITICAL FIX: Catch BullMQ Worker background errors
  worker.on("error", (err) => {
    logger.error(`[BullMQ] scheduledMessageWorker background error: ${err.message}`);
  });
};

/**
 * Export worker initializer AND the queue (so controllers can add jobs)
 */
module.exports = { startMessageScheduler, scheduledMessageQueue };