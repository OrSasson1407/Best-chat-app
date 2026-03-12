const Message = require("../models/Message"); 
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const urlMetadata = require('url-metadata');
const { notificationQueue } = require("../workers/notificationWorker"); 

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const extractUrls = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex);
};

class MessageService {
  async processAndSaveMessage(payload) {
    const { from, to, message, type, replyTo, isForwarded, isViewOnce, pollData, timer, scheduledAt, fileName, fileSize } = payload;

    const receiver = await User.findById(to);
    if (receiver && receiver.blockedUsers && receiver.blockedUsers.includes(from)) {
      throw new Error("Cannot send message. You are blocked by this user.");
    }

    let finalContent = message;
    let linkMetadata = null;
    let fileMetadata = null;
    let finalType = type || "text";

    // Handle Media Upload
    if (["image", "video", "audio", "file"].includes(type) && message.startsWith("data:")) {
      const uploadRes = await cloudinary.uploader.upload(message, {
        resource_type: "auto", 
        folder: "best_chat_app_media", 
      });
      finalContent = uploadRes.secure_url; 
      
      if (type === "file") {
        fileMetadata = {
            fileName: fileName || "Attachment",
            fileSize: fileSize || "Unknown size",
            publicId: uploadRes.public_id
        };
      }
    }

    // Handle Link Metadata
    if (finalType === "text" || finalType === "link") {
        const urls = extractUrls(message);
        if (urls && urls.length > 0) {
            try {
                const metadata = await urlMetadata(urls[0]);
                linkMetadata = {
                    title: metadata.title,
                    description: metadata.description,
                    image: metadata.image,
                    url: urls[0]
                };
                finalType = "link";
            } catch (err) { 
                console.log("Failed to fetch metadata for link:", err.message); 
            }
        }
    }

    let expireAt = null;
    if (timer) expireAt = new Date(Date.now() + timer * 1000); 

    const isSent = scheduledAt ? new Date(scheduledAt) <= new Date() : true;

    const data = await Message.create({
      message: { text: finalContent },
      users: [from, to],
      sender: from,
      type: finalType,
      replyTo: replyTo || null,
      status: isSent ? "sent" : "pending",
      isForwarded: isForwarded || false,
      isViewOnce: isViewOnce || false,
      pollData: pollData || null,
      linkMetadata: linkMetadata,
      fileMetadata: fileMetadata, 
      timer: timer || null,
      expireAt,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      isSent,
      deletedFor: [] 
    });

    // Handle FCM Notifications
    if (isSent && receiver && receiver.fcmToken && !global.onlineUsers?.has(to)) {
       try {
         const senderUser = await User.findById(from);
         await notificationQueue.add("send_fcm_message", {
           userId: receiver._id,
           fcmToken: receiver.fcmToken,
           title: `New message from ${senderUser.username}`,
           body: finalType === "text" ? "Sent a message" : `Sent a ${finalType}`,
         }, {
           attempts: 3,
           backoff: { type: 'exponential', delay: 1000 }
         });
       } catch (err) {
         console.error("Failed to queue FCM Notification:", err.message);
       }
    }

    return data;
  }

  async fetchMessages(from, to, cursor, limit) {
    let query = { 
        users: { $all: [from, to] },
        deletedFor: { $ne: from }, 
        $or: [
            { isSent: true },
            { sender: from, isSent: false }
        ]
    };

    // BUG FIX: Using _id for cursor instead of createdAt to prevent skipping messages
    if (cursor) {
      query._id = { $lt: cursor }; 
    }

    const messages = await Message.find(query)
      .sort({ _id: -1 }) // Sort by _id descending
      .limit(limit)
      .populate("replyTo", "message.text sender type isDeleted");

    messages.reverse();

    const projectedMessages = messages.map((msg) => {
      const hasViewed = msg.viewed || (msg.viewedBy && msg.viewedBy.includes(from));
      const isHiddenViewOnce = msg.isViewOnce && hasViewed && msg.sender.toString() !== from;

      return {
        id: msg._id,
        fromSelf: msg.sender.toString() === from,
        message: msg.isDeleted ? "🚫 This message was deleted" : isHiddenViewOnce ? "💣 Media Expired" : msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt, 
        status: msg.status || "sent", 
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
        isForwarded: msg.isForwarded,
        isViewOnce: msg.isViewOnce,
        viewed: hasViewed,
        isPinned: msg.isPinned,
        isStarred: msg.starredBy && msg.starredBy.includes(from),
        pollData: msg.pollData,
        linkMetadata: msg.linkMetadata,
        fileMetadata: msg.fileMetadata, 
        timer: msg.timer,
        scheduledAt: msg.scheduledAt,
        isSent: msg.isSent,
        readBy: msg.readBy,
        replyTo: msg.replyTo ? {
            id: msg.replyTo._id,
            text: msg.replyTo.isDeleted ? "🚫 This message was deleted" : msg.replyTo.message.text,
            type: msg.replyTo.type,
            isSelfQuote: msg.replyTo.sender.toString() === from
        } : null,
        reactions: msg.reactions || [],
      };
    });

    return {
        messages: projectedMessages,
        hasMore: messages.length === limit, 
        nextCursor: messages.length > 0 ? messages[0]._id : null // Next cursor is the oldest _id in this batch
    };
  }
}

module.exports = new MessageService();