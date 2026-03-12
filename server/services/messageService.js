const Message = require("../models/Message"); 
const User = require("../models/User");
const urlMetadata = require('url-metadata');
const { notificationQueue } = require("../workers/notificationWorker"); 

// STEP 6 FIX: Import the new async media worker queue
const { mediaQueue } = require("../workers/mediaWorker"); 

const { createClient } = require("redis");

// Initialize Redis for Hot Cache
const cacheClient = createClient({ url: process.env.REDIS_URI || "redis://localhost:6379" });
cacheClient.connect().catch(err => console.error("Message Cache Client Error:", err));

const extractUrls = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex);
};

class MessageService {

  // Helper to generate a unique cache key for a conversation
  getChatCacheKey(user1, user2) {
    const sortedIds = [user1.toString(), user2.toString()].sort();
    return `chat_history:${sortedIds[0]}:${sortedIds[1]}`;
  }

  async processAndSaveMessage(payload) {
    const { from, to, message, type, replyTo, isForwarded, isViewOnce, pollData, timer, scheduledAt, fileName, fileSize } = payload;

    const receiver = await User.findById(to);
    if (receiver && receiver.blockedUsers && receiver.blockedUsers.includes(from)) {
      throw new Error("Cannot send message. You are blocked by this user.");
    }

    let linkMetadata = null;
    let fileMetadata = null;
    let finalType = type || "text";

    // Handle Link Metadata immediately (it is fast enough to do synchronously)
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
    
    // STEP 6 FIX: Determine if the message is a media upload
    const isMedia = ["image", "video", "audio", "file"].includes(finalType) && message.startsWith("data:");

    // STEP 6 FIX: Determine Status. Media bypasses "sent" initially to become "processing"
    let initialStatus = isMedia ? "processing" : (isSent ? "sent" : "pending");

    const data = await Message.create({
      message: { text: message }, // For media, this temporarily stores the base64 string
      users: [from, to],
      sender: from,
      type: finalType,
      replyTo: replyTo || null,
      status: initialStatus,
      isForwarded: isForwarded || false,
      isViewOnce: isViewOnce || false,
      pollData: pollData || null,
      linkMetadata: linkMetadata,
      fileMetadata: isMedia && finalType === "file" ? { fileName, fileSize } : null, 
      timer: timer || null,
      expireAt,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      isSent,
      deletedFor: [] 
    });

    // --- STEP 6 FIX: ASYNC MEDIA PIPELINE TRIGGER ---
    if (isMedia) {
      await mediaQueue.add("process_media", {
        messageId: data._id,
        from, to, type: finalType, fileName, fileSize
      });
      // Return immediately so the sender's UI is not blocked. 
      // The background worker handles the Cloudinary upload and updates Redis later.
      return data; 
    }

    // --- HOT CACHE & NOTIFICATIONS (Only executes synchronously for standard text/links) ---
    if (cacheClient.isReady && isSent) {
      const cacheKey = this.getChatCacheKey(from, to);
      
      // Fetch populated replyTo data if it exists so the cache matches the frontend's expected structure
      let populatedReplyTo = null;
      if (replyTo) {
        const replyMsg = await Message.findById(replyTo).select("message.text sender type isDeleted");
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
        id: data._id,
        sender: from,
        message: data.message.text,
        type: data.type,
        createdAt: data.createdAt,
        status: data.status,
        isDeleted: data.isDeleted || false,
        isEdited: data.isEdited || false,
        isForwarded: data.isForwarded || false,
        isViewOnce: data.isViewOnce || false,
        viewed: false,
        isPinned: false,
        isStarred: false,
        pollData: data.pollData || null,
        linkMetadata: data.linkMetadata || null,
        fileMetadata: data.fileMetadata || null,
        timer: data.timer || null,
        scheduledAt: data.scheduledAt || null,
        isSent: data.isSent,
        readBy: [],
        replyTo: populatedReplyTo,
        reactions: []
      });

      await cacheClient.lPush(cacheKey, messageToCache);
      await cacheClient.lTrim(cacheKey, 0, 49); // Keep latest 50
      await cacheClient.expire(cacheKey, 86400); // Expire idle chats after 24h
    }

    // Handle FCM Notifications
    if (isSent && receiver && receiver.fcmToken && !global.onlineUsers?.has(to)) {
       try {
         const senderUser = await User.findById(from);
         await notificationQueue.add("send_fcm_message", {
           userId: receiver._id,
           fcmToken: receiver.fcmToken,
           title: `New message from ${senderUser.username}`,
           body: finalType === "text" ? "Sent a message" : `Sent a ${finalType}`,
         }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
       } catch (err) {
         console.error("Failed to queue FCM Notification:", err.message);
       }
    }

    return data;
  }

  async fetchMessages(from, to, cursor, limit) {
    const cacheKey = this.getChatCacheKey(from, to);

    // STEP 2 FIX: REDIS CACHE STRATEGY
    if (!cursor && cacheClient.isReady) {
      const cachedData = await cacheClient.lRange(cacheKey, 0, limit - 1);
      
      // ONLY use the cache if it can fulfill the entire requested limit.
      // If the cache only has 3 messages but the limit is 20, we fallback to MongoDB
      // to guarantee the user sees a full screen of history.
      if (cachedData && cachedData.length === limit) {
        const parsedCache = cachedData.map(msgStr => {
          const msg = JSON.parse(msgStr);
          msg.fromSelf = msg.sender.toString() === from.toString(); 
          
          // Apply ViewOnce / Deleted masking
          const isHiddenViewOnce = msg.isViewOnce && msg.viewed && !msg.fromSelf;
          if (isHiddenViewOnce) msg.message = "💣 Media Expired";
          if (msg.isDeleted) msg.message = "🚫 This message was deleted";
          
          return msg;
        });

        // Safely reverse without mutating the original reference mapped array
        const reversedCache = [...parsedCache].reverse();

        return {
          messages: reversedCache,
          hasMore: true, // We know there are likely more messages in the DB if cache is full
          nextCursor: reversedCache[0].id // Oldest message in this batch acts as the next cursor
        };
      }
    }

    // FALLBACK TO MONGODB
    let query = { 
        users: { $all: [from, to] },
        deletedFor: { $ne: from }, 
        $or: [
            { isSent: true },
            { sender: from, isSent: false }
        ]
    };

    if (cursor) query._id = { $lt: cursor }; 

    const messages = await Message.find(query)
      .sort({ _id: -1 })
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
        nextCursor: messages.length > 0 ? messages[0]._id : null
    };
  }
}

module.exports = new MessageService();