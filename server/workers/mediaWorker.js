const { Queue, Worker } = require("bullmq");
const cloudinary = require("cloudinary").v2;
const Message = require("../models/Message");
const User = require("../models/User");
const { notificationQueue } = require("./notificationWorker");
const { createClient } = require("redis");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};

const mediaQueue = new Queue("media_processing", { connection });
const cacheClient = createClient({ url: process.env.REDIS_URI || "redis://localhost:6379" });
cacheClient.connect().catch(err => console.warn("Media Worker Cache Client Error:", err));

const getChatCacheKey = (user1, user2) => {
  const sortedIds = [user1.toString(), user2.toString()].sort();
  return `chat_history:${sortedIds[0]}:${sortedIds[1]}`;
};

const worker = new Worker("media_processing", async (job) => {
  const { messageId, from, to, type, fileName, fileSize } = job.data;
  
  const message = await Message.findById(messageId);
  if (!message || message.status !== "processing") return;

  const base64Data = message.message.text;
  const isSent = message.scheduledAt ? new Date(message.scheduledAt) <= new Date() : true;

  try {
      // 1. Upload to Cloudinary without blocking the main event loop
      const uploadRes = await cloudinary.uploader.upload(base64Data, {
        resource_type: "auto", 
        folder: "best_chat_app_media", 
      });

      // 2. Update MongoDB with secure URL and resolve status
      message.message.text = uploadRes.secure_url;
      message.status = isSent ? "sent" : "pending"; // Respect scheduled messages
      
      if (type === "file") {
        message.fileMetadata = {
            fileName: fileName || "Attachment",
            fileSize: fileSize || "Unknown size",
            publicId: uploadRes.public_id
        };
      }
      await message.save();

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
         global.chatSocket.to(to).emit("media-ready", { messageId, url: uploadRes.secure_url, type });
         global.chatSocket.to(from).emit("media-ready", { messageId, url: uploadRes.secure_url, type });
      }

      // 5. Trigger FCM Push Notification
      if (isSent) {
          const receiver = await User.findById(to).select("fcmToken");
          if (receiver && receiver.fcmToken) {
             const isOnline = await cacheClient.hExists("online_users", to);
             if (!isOnline) {
                 const senderUser = await User.findById(from).select("username");
                 await notificationQueue.add("send_fcm_message", {
                   userId: to,
                   fcmToken: receiver.fcmToken,
                   title: `New message from ${senderUser.username}`,
                   body: `Sent a ${type}`,
                 }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
             }
          }
      }

  } catch (err) {
      console.error(`Media Worker Error for message ${messageId}:`, err);
      message.status = "failed";
      message.message.text = "Failed to upload media.";
      await message.save();
      
      if (global.chatSocket) {
         global.chatSocket.to(from).emit("media-failed", { messageId });
      }
  }
}, { connection });

worker.on("completed", (job) => console.log(`[BullMQ] Media Job ${job.id} completed.`));
worker.on("failed", (job, err) => console.error(`[BullMQ] Media Job ${job.id} failed:`, err.message));

module.exports = { mediaQueue };