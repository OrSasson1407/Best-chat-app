const { Queue, Worker } = require("bullmq");
const admin = require("firebase-admin");

// --- FIREBASE ADMIN SETUP ---
// You will need to download your Service Account JSON from the Firebase Console
// (Project Settings > Service Accounts > Generate new private key)
// For now, we will mock the initialization so it doesn't crash your server if the file is missing.
try {
  const serviceAccount = require("../firebase-service-account.json"); 
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("🔥 Firebase Admin initialized successfully.");
} catch (err) {
  console.warn("⚠️ Firebase Admin not initialized. Push notifications will be skipped. Ensure firebase-service-account.json exists.");
}

// Create the Queue (Requires Redis)
const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};

const notificationQueue = new Queue("notifications", { connection });

// Create the Worker to process jobs
const worker = new Worker("notifications", async (job) => {
  if (job.name === "send_fcm_message") {
    const { userId, fcmToken, title, body } = job.data;

    if (!fcmToken) return;

    const message = {
      notification: {
        title: title,
        body: body,
      },
      token: fcmToken,
      // Custom data payload so the frontend knows what chat to open
      data: {
         click_action: "FLUTTER_NOTIFICATION_CLICK",
         userId: userId.toString()
      }
    };

    try {
      if (admin.apps.length > 0) {
          const response = await admin.messaging().send(message);
          console.log(`✅ Push notification sent to ${userId}:`, response);
      }
    } catch (error) {
      console.error(`❌ Failed to send push notification to ${userId}:`, error.message);
      // If token is unregistered (user uninstalled/cleared data), you might want to remove it from the DB here
    }
  }
}, { connection });

worker.on("completed", (job) => console.log(`Job ${job.id} completed.`));
worker.on("failed", (job, err) => console.error(`Job ${job.id} failed:`, err.message));

module.exports = { notificationQueue };