const { Queue, Worker } = require("bullmq");
const cloudinary = require("cloudinary").v2;
const Message = require("../models/Message");
const User = require("../models/User");
const { notificationQueue } = require("./notificationWorker");
const { Readable } = require("stream"); // ADDED: For streaming uploads to save RAM

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const { bullMQConnection: connection } = require("../config/redis");

const mediaQueue = new Queue("media_processing", { connection });

// CRITICAL FIX: Catch BullMQ Queue background errors
mediaQueue.on("error", (err) => {
  console.error(`[BullMQ] mediaQueue background error: ${err.message}`);
});

const { createRedisClient, bullMQConnection } = require("../config/redis");
const cacheClient = createRedisClient();

// CRITICAL FIX: Catch Redis cache background errors
cacheClient.on("error", (err) => {
  console.warn("Media Worker Cache Client Background Error:", err.message);
});

// LAZY CONNECT FIX: Connect in background, don't block startup
cacheClient.connect().catch(() => {});

const getChatCacheKey = (user1, user2) => {
  const sortedIds = [user1.toString(), user2.toString()].sort();
  return `chat_history:${sortedIds[0]}:${sortedIds[1]}`;
};

// ADDED: Helper for stream-based Cloudinary upload
const streamUpload = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { 
              resource_type: "auto", 
              folder: "best_chat_app_media",
              // IMPROVEMENT: On-the-fly eager transformations to compress and optimize images for mobile
              eager: [{ fetch_format: "auto", quality: "auto", width: 1200, crop: "limit" }]
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        Readable.from(buffer).pipe(stream);
    });
};

const worker = new Worker("media_processing", async (job) => {
  const { messageId, from, to, type, fileName, fileSize } = job.data;
  
  await job.updateProgress(10); // ADDED: Report initial progress to BullMQ
  
  const message = await Message.findById(messageId);
  if (!message || message.status !== "processing") return;

  const base64Data = message.message.text;
  const isSent = message.scheduledAt ? new Date(message.scheduledAt) <= new Date() : true;

  try {
      await job.updateProgress(30);

      // 1. IMPROVEMENT: Upload via Node Streams to prevent blocking the event loop and consuming massive RAM
      const base64Content = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      const fileBuffer = Buffer.from(base64Content, "base64");
      
      const uploadRes = await streamUpload(fileBuffer);
      
      await job.updateProgress(70);

      // Use the optimized WebP/AVIF version if it's an image and available, else fallback to standard secure_url
      const finalUrl = (uploadRes.eager && uploadRes.eager[0]) ? uploadRes.eager[0].secure_url : uploadRes.secure_url;

      // 2. Update MongoDB with secure URL and resolve status
      message.message.text = finalUrl;
      message.status = isSent ? "sent" : "pending"; // Respect scheduled messages
      
      if (type === "file") {
        message.fileMetadata = {
            fileName: fileName || "Attachment",
            fileSize: fileSize || "Unknown size",
            publicId: uploadRes.public_id
        };
      }
      await message.save();

      await job.updateProgress(85);

      // 3. Update Redis Hot Cache (Only if message is active/sent)
      if (cacheClient.isReady && isSent) {
          const cacheKey = getChatCacheKey(from, to);
          
          let populatedReplyTo = null;
          if (message.replyTo) {
            const replyMsg = await Message.findById(message.replyTo).select("message.text sender type isDeleted");
            if (replyMsg) {
              populatedReplyTo = {
                id: replyMsg._id,
                text: replyMsg.isDeleted ? "🚫 This message was deleted" : replyMsg.message.text,
                type: replyMsg.type,
                isSelfQuote: replyMsg.sender.toString() === from.toString()
              };
            }
          }

          const messageToCache = JSON.stringify({
            id: message._id,
            sender: from,
            message: message.message.text,
            type: message.type,
            createdAt: message.createdAt,
            status: message.status,
            isDeleted: false,
            isEdited: false,
            isForwarded: message.isForwarded || false,
            isViewOnce: message.isViewOnce || false,
            viewed: false,
            isPinned: false,
            isStarred: false,
            pollData: message.pollData || null,
            linkMetadata: message.linkMetadata || null,
            fileMetadata: message.fileMetadata || null,
            timer: message.timer || null,
            scheduledAt: message.scheduledAt || null,
            isSent: message.isSent,
            readBy: [],
            replyTo: populatedReplyTo,
            reactions: []
          });

          await cacheClient.lPush(cacheKey, messageToCache);
          await cacheClient.lTrim(cacheKey, 0, 49);
          await cacheClient.expire(cacheKey, 86400);
      }

      // 4. Emit Socket Event to update clients in real-time
      if (global.chatSocket && isSent) {
         global.chatSocket.to(to).emit("media-ready", { messageId, url: finalUrl, type });
         global.chatSocket.to(from).emit("media-ready", { messageId, url: finalUrl, type });
      }

      // 5. Trigger FCM Push Notification
      if (isSent) {
          // FIX: select fcmTokens (array), not the old fcmToken (string)
          const receiver = await User.findById(to).select("fcmTokens");
          if (receiver && receiver.fcmTokens && receiver.fcmTokens.length > 0) {
             // FIX: check user_sockets set — online_users hash is no longer written
             const isOnline = (await cacheClient.sCard(`user_sockets:${to}`)) > 0;
             if (!isOnline) {
                 const senderUser = await User.findById(from).select("username");
                 await notificationQueue.add("send_fcm_message", {
                   userId: to,
                   fcmTokens: receiver.fcmTokens,  // FIX: array, matches notificationWorker
                   title: `New message from ${senderUser.username}`,
                   body: `Sent a ${type}`,
                 }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
             }
          }
      }

      await job.updateProgress(100); // ADDED: Mark job as 100% complete

  } catch (err) {
      console.error(`Media Worker Error for message ${messageId}:`, err);
      message.status = "failed";
      message.message.text = "Failed to upload media.";
      await message.save();
      
      if (global.chatSocket) {
         global.chatSocket.to(from).emit("media-failed", { messageId });
      }
      
      throw err; // ADDED: Rethrow error so BullMQ knows the job failed and can trigger a retry
  }
}, { 
    connection,
    concurrency: 5 // ADDED: Process up to 5 media uploads concurrently (avoids queue bottlenecks)
});

worker.on("completed", (job) => console.log(`[BullMQ] Media Job ${job.id} completed.`));
worker.on("failed", (job, err) => console.error(`[BullMQ] Media Job ${job.id} failed:`, err.message));

// CRITICAL FIX: Catch BullMQ Worker background errors
worker.on("error", (err) => {
  console.error(`[BullMQ] mediaWorker background error: ${err.message}`);
});

module.exports = { mediaQueue };