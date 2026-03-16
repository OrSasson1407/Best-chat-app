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
const User = require("../models/User"); // Required to clean up stale FCM tokens



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
const { bullMQConnection: connection } = require("../config/redis");



/* =========================================================
   QUEUE DEFINITION
   ========================================================= */

/**
 * Notification Queue
 *
 * Jobs added here will be processed by the worker.
 */
// Added defaultJobOptions to handle retries and keep Redis memory clean
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
    
    // Skip processing entirely if Firebase failed to initialize
    if (admin.apps.length === 0) return;

    // ----------------------------------------------------
    // 1. Handle SINGLE User push notifications
    // ----------------------------------------------------
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
        const response = await admin.messaging().send(message);
        console.log(`✅ Push notification sent to ${userId}:`, response);
      } catch (error) {
        /**
         * Handle push notification errors
         */
        console.error(`❌ Failed to send push notification to ${userId}:`, error.message);

        /**
         * Logic to actually remove the dead token from the database
         */
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          console.log(`🧹 Removing stale FCM token for user ${userId}`);
          await User.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });
          
          return; // Return so BullMQ knows NOT to retry sending to this dead token
        }

        // Rethrow the error if it was a network issue, so BullMQ triggers a retry
        throw error;
      }

    }

    // ----------------------------------------------------
    // 2. IMPROVEMENT: Handle MULTICAST (Group) notifications
    // ----------------------------------------------------
    else if (job.name === "send_multicast_message") {
      const { fcmTokens, title, body, groupId } = job.data;
      
      if (!fcmTokens || fcmTokens.length === 0) return;

      // Firebase limit is 500 tokens per multicast batch
      const maxBatchTokens = fcmTokens.slice(0, 500);

      const message = {
        notification: {
          title: title,
          body: body,
        },
        tokens: maxBatchTokens,
        data: {
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          groupId: groupId.toString()
        }
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        
        // Clean up any dead tokens from the batch efficiently
        if (response.failureCount > 0) {
          const failedTokens = [];
          
          response.responses.forEach((resp, idx) => {
            if (!resp.success && (
              resp.error.code === 'messaging/invalid-registration-token' || 
              resp.error.code === 'messaging/registration-token-not-registered'
            )) {
              failedTokens.push(maxBatchTokens[idx]);
            }
          });

          if (failedTokens.length > 0) {
            console.log(`🧹 Removing ${failedTokens.length} stale FCM tokens from multicast batch`);
            await User.updateMany(
              { fcmToken: { $in: failedTokens } },
              { $unset: { fcmToken: "" } }
            );
          }
        }
      } catch (error) {
        console.error(`❌ Multicast Notification Error:`, error.message);
        throw error; // Rethrow to trigger BullMQ retry
      }
    }

  },
  { 
      connection,
      concurrency: 10 // ADDED: Process up to 10 notification jobs simultaneously for high throughput
  }
);



/* =========================================================
   WORKER EVENTS
   ========================================================= */

/**
 * Triggered when a job completes successfully
 */
worker.on("completed", (job) =>
  console.log(`[BullMQ] Notification Job ${job.id} completed.`)
);

/**
 * Triggered when a job fails
 */
worker.on("failed", (job, err) =>
  console.error(`[BullMQ] Notification Job ${job.id} failed:`, err.message)
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
 * * await notificationQueue.add("send_multicast_message", {
 * groupId,
 * fcmTokens: ["token1", "token2", ...],
 * title: "Group Chat",
 * body: "New message in Group!"
 * });
 */
module.exports = { notificationQueue };