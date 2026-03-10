/**
 * Push Notification Queue System
 * --------------------------------------------------------
 * This module handles asynchronous push notifications
 * using BullMQ (Redis-based job queue).
 *
 * Responsibilities:
 * - Queue push notification jobs
 * - Process jobs using a background worker
 * - Send push notifications via Firebase Cloud Messaging (FCM)
 *
 * Benefits:
 * - Prevents blocking API requests
 * - Scales across multiple servers
 * - Handles retries and failures
 *
 * Queue Name:
 * "notifications"
 */

const { Queue, Worker } = require("bullmq"); // Redis job queue system
const admin = require("firebase-admin"); // Firebase Admin SDK for push notifications
const User = require("../models/User"); // ADDED: Required to clean up stale FCM tokens



/* =========================================================
   FIREBASE ADMIN INITIALIZATION
   ========================================================= */

/**
 * Firebase Admin is required to send FCM push notifications.
 *
 * You must download the service account key from:
 *
 * Firebase Console
 * → Project Settings
 * → Service Accounts
 * → Generate new private key
 *
 * The file should be placed in:
 * /firebase-service-account.json
 */

try {

  const serviceAccount = require("../firebase-service-account.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("🔥 Firebase Admin initialized successfully.");

} catch (err) {

  /**
   * If Firebase credentials are missing,
   * the server will continue running but push
   * notifications will be skipped.
   */
  console.warn(
    "⚠️ Firebase Admin not initialized. Push notifications will be skipped. Ensure firebase-service-account.json exists."
  );

}



/* =========================================================
   REDIS CONNECTION
   ========================================================= */

/**
 * Redis connection used by BullMQ.
 * Required for job queue persistence.
 */
const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};



/* =========================================================
   QUEUE DEFINITION
   ========================================================= */

/**
 * Notification Queue
 *
 * Jobs added here will be processed by the worker.
 */
// ADDED: Added defaultJobOptions to handle retries and keep Redis memory clean
const notificationQueue = new Queue("notifications", { 
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000 // Wait 2s, then 4s, then 8s between retries
    },
    removeOnComplete: true, // Delete job from Redis when done
    removeOnFail: 100 // Keep only the last 100 failed jobs for debugging
  }
});



/* =========================================================
   WORKER PROCESSOR
   ========================================================= */

/**
 * Worker responsible for processing queued jobs.
 *
 * It listens for jobs added to the "notifications" queue.
 */
const worker = new Worker(
  "notifications",

  /**
   * Job handler
   */
  async (job) => {

    /**
     * Handle FCM push notification jobs
     */
    if (job.name === "send_fcm_message") {

      const { userId, fcmToken, title, body } = job.data;

      /**
       * If the user has no FCM token,
       * skip sending notification.
       */
      if (!fcmToken) return;


      /**
       * Construct FCM message payload
       */
      const message = {

        notification: {
          title: title,
          body: body,
        },

        token: fcmToken,

        /**
         * Custom data payload
         * Used by mobile apps or web apps
         * to navigate to the correct chat.
         */
        data: {
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          userId: userId.toString()
        }

      };


      try {

        /**
         * Send push notification if Firebase initialized
         */
        if (admin.apps.length > 0) {

          const response =
            await admin.messaging().send(message);

          console.log(
            `✅ Push notification sent to ${userId}:`,
            response
          );
        }

      } catch (error) {

        /**
         * Handle push notification errors
         */
        console.error(
          `❌ Failed to send push notification to ${userId}:`,
          error.message
        );

        /**
         * Optional improvement:
         * If token becomes invalid (user uninstalled app),
         * remove it from the database.
         */
        // ADDED: Logic to actually remove the dead token from the database
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          console.log(`🧹 Removing stale FCM token for user ${userId}`);
          await User.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });
          
          return; // Return so BullMQ knows NOT to retry sending to this dead token
        }

        // ADDED: Rethrow the error if it was a network issue, so BullMQ triggers a retry
        throw error;
      }

    }

  },

  { connection }
);



/* =========================================================
   WORKER EVENTS
   ========================================================= */

/**
 * Triggered when a job completes successfully
 */
worker.on("completed", (job) =>
  console.log(`Job ${job.id} completed.`)
);

/**
 * Triggered when a job fails
 */
worker.on("failed", (job, err) =>
  console.error(`Job ${job.id} failed:`, err.message)
);



/* =========================================================
   MODULE EXPORTS
   ========================================================= */

/**
 * Export the queue so other parts of the system
 * can enqueue push notification jobs.
 *
 * Example usage:
 *
 * await notificationQueue.add("send_fcm_message", {
 * userId,
 * fcmToken,
 * title: "New Message",
 * body: "You received a new message"
 * });
 */
module.exports = { notificationQueue };