// server/workers/notificationWorker.js
const { Queue, Worker } = require("bullmq");
const logger = require("../utils/logger");

// 1. Initialize the Queue using your existing Redis connection
const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};

const notificationQueue = new Queue("PushNotifications", { connection });

// 2. Define the Worker (The background process that actually does the work)
const notificationWorker = new Worker(
  "PushNotifications",
  async (job) => {
    logger.info(`Processing notification job: ${job.id}`);
    const { userId, title, body, fcmToken } = job.data;

    try {
      // Simulate Firebase Admin SDK sending a message
      // await admin.messaging().send({ token: fcmToken, notification: { title, body } });
      
      logger.info(`Successfully sent push notification to user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to send notification: ${error.message}`);
      throw error; // BullMQ will automatically retry failed jobs if configured!
    }
  },
  { connection }
);

// Event listeners for monitoring the background worker
notificationWorker.on("completed", (job) => {
  logger.info(`Job ${job.id} has completed!`);
});

notificationWorker.on("failed", (job, err) => {
  logger.error(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = { notificationQueue };