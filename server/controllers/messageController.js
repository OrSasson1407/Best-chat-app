const Message = require("../models/Message"); 
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const urlMetadata = require('url-metadata'); // For Rich Link Previews

// --- LEVEL 4: ENTERPRISE BACKGROUND QUEUE ---
const { notificationQueue } = require("../workers/notificationWorker"); 

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Helper to detect URLs in text for link previews
const extractUrls = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex);
};

// --- NEW FEATURE: Search Messages ---
module.exports.searchMessages = async (req, res, next) => {
  try {
    const { userId, query } = req.body;
    // Uses the MongoDB text index on message.text
    const messages = await Message.find({
      users: { $in: [userId] },
      $text: { $search: query }
    }).sort({ score: { $meta: "textScore" } }).limit(20);
    
    return res.json({ status: true, messages });
  } catch (ex) {
    next(ex);
  }
};

// --- PHASE 3: In-App Media Gallery Fetcher (Updated with Filtering) ---
module.exports.getChatMedia = async (req, res, next) => {
  try {
    const { from, to, filterType } = req.body; 
    
    // Determine which types to fetch based on frontend request
    let typesToFetch = ["image", "video", "file", "link"];
    if (filterType === 'media') typesToFetch = ["image", "video"];
    if (filterType === 'links') typesToFetch = ["link"];
    if (filterType === 'files') typesToFetch = ["file"];

    // Find messages between these two users that are media or links
    const query = { 
        users: { $all: [from, to] },
        type: { $in: typesToFetch },
        isDeleted: false, // Don't show deleted media in the gallery
        deletedFor: { $ne: from } // Hide media if user deleted it for themselves
    };

    const messages = await Message.find(query).sort({ createdAt: -1 });

    const mediaList = messages.map((msg) => {
      // Check if view-once media was already viewed by the current user
      const hasViewed = msg.viewed || (msg.viewedBy && msg.viewedBy.includes(from));
      const isHiddenViewOnce = msg.isViewOnce && hasViewed && msg.sender.toString() !== from;

      return {
        id: msg._id,
        fromSelf: msg.sender.toString() === from,
        message: isHiddenViewOnce ? "💣 Media Expired" : msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt, 
        isViewOnce: msg.isViewOnce,
        viewed: hasViewed,
        linkMetadata: msg.linkMetadata,
        fileMetadata: msg.fileMetadata // --- MERGE UPDATE: Expose to Gallery
      };
    }).filter(msg => msg.message !== "💣 Media Expired"); // Completely hide expired view-once media from the gallery

    res.json({
        status: true,
        media: mediaList
    });
  } catch (ex) {
    next(ex);
  }
};

// --- NEW FEATURE: Infinite Scrolling & Phase 2 Scheduled Message Filter ---
module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to, cursor, limit = 50 } = req.body; 

    // PHASE 2 & 3: Filter for sent status AND deletedFor
    let query = { 
        users: { $all: [from, to] },
        deletedFor: { $ne: from }, 
        $or: [
            { isSent: true },
            { sender: from, isSent: false }
        ]
    };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) }; 
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("replyTo", "message.text sender type isDeleted");

    messages.reverse();

    const projectedMessages = messages.map((msg) => {
      // Phase 2: Check if view-once media was already viewed by the current user
      const hasViewed = msg.viewed || msg.viewedBy.includes(from);
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
        isStarred: msg.starredBy.includes(from),
        pollData: msg.pollData,
        linkMetadata: msg.linkMetadata,
        fileMetadata: msg.fileMetadata, // --- MERGE UPDATE: Expose to UI

        // Phase 2: Expose timer and schedule state to UI
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

    res.json({
        messages: projectedMessages,
        hasMore: messages.length === limit, 
        nextCursor: messages.length > 0 ? messages[0].createdAt : null 
    });
  } catch (ex) {
    next(ex);
  }
};

// --- Add Message (Updated with Phase 2 Expiration & Scheduling Logic) ---
module.exports.addMessage = async (req, res, next) => {
  try {
    // --- MERGE UPDATE: Destructure fileName and fileSize from frontend request ---
    const { from, to, message, type, replyTo, isForwarded, isViewOnce, pollData, timer, scheduledAt, fileName, fileSize } = req.body;

    const receiver = await User.findById(to);
    if (receiver && receiver.blockedUsers.includes(from)) {
      return res.status(403).json({ msg: "Cannot send message. You are blocked by this user." });
    }

    let finalContent = message;
    let linkMetadata = null;
    let fileMetadata = null; // Prepare metadata object
    let finalType = type || "text";

    if (["image", "video", "audio", "file"].includes(type) && message.startsWith("data:")) {
      const uploadRes = await cloudinary.uploader.upload(message, {
        resource_type: "auto", 
        folder: "best_chat_app_media", 
      });
      finalContent = uploadRes.secure_url; 
      
      // --- MERGE UPDATE: Save metadata so the UI knows the file's original name and size ---
      if (type === "file") {
        fileMetadata = {
            fileName: fileName || "Attachment",
            fileSize: fileSize || "Unknown size",
            publicId: uploadRes.public_id
        };
      }
    }

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

    // Phase 2: Compute Self-Destruct Timer
    let expireAt = null;
    if (timer) {
        expireAt = new Date(Date.now() + timer * 1000); 
    }

    // Phase 2: Compute Scheduling
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
      fileMetadata: fileMetadata, // --- MERGE UPDATE: Save metadata to DB
      
      timer: timer || null,
      expireAt,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      isSent,
      deletedFor: [] // Initialize empty array for deletes
    });

    if (isSent && !global.onlineUsers.has(to) && receiver && receiver.fcmToken) {
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

    if (data) return res.json({ msg: "Message added successfully.", data });
    else return res.json({ msg: "Failed to add message" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.reactToMessage = async (req, res, next) => {
  try {
    const { messageId, emoji, userId, username } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    const existingReaction = message.reactions.findIndex(r => r.by.toString() === userId && r.emoji === emoji);
    
    if (existingReaction > -1) {
        message.reactions.splice(existingReaction, 1);
    } else {
        message.reactions.push({ emoji, by: userId, username });
    }

    await message.save();
    return res.json({ msg: "Reaction updated", reactions: message.reactions });
  } catch (ex) {
    next(ex);
  }
};

// Delete for Everyone
module.exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Unauthorized action: You can only delete your own messages." });
    }

    message.isDeleted = true;
    message.message.text = "🚫 This message was deleted";
    message.reactions = []; 
    message.linkMetadata = null;
    message.fileMetadata = null; // --- MERGE UPDATE: clear on delete
    message.pollData = null;
    await message.save();

    return res.json({ msg: "Message deleted successfully." });
  } catch (ex) {
    next(ex);
  }
};

// --- NEW Delete for Me Controller ---
module.exports.deleteMessageForMe = async (req, res, next) => {
  try {
    const { messageId, userId } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    // Initialize array if it doesn't exist in the older schema records
    if (!message.deletedFor) message.deletedFor = [];
    
    // Add user to the deleted list
    if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
    }

    return res.json({ msg: "Message deleted for you." });
  } catch (ex) {
    next(ex);
  }
};

module.exports.editMessage = async (req, res, next) => {
  try {
    const { messageId, newText } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Unauthorized action: You can only edit your own messages." });
    }

    if (message.isDeleted) return res.status(400).json({ msg: "Cannot edit a deleted message" });
    if (message.isViewOnce) return res.status(400).json({ msg: "Cannot edit a view-once message" });

    message.message.text = newText;
    message.isEdited = true;
    
    if (message.type === "text" || message.type === "link") {
        const urls = extractUrls(newText);
        if (urls && urls.length > 0) {
            try {
                const metadata = await urlMetadata(urls[0]);
                message.linkMetadata = { title: metadata.title, description: metadata.description, image: metadata.image, url: urls[0] };
                message.type = "link";
            } catch (err) { message.linkMetadata = null; message.type = "text"; }
        } else {
            message.linkMetadata = null; message.type = "text";
        }
    }

    await message.save();

    return res.json({ msg: "Message edited successfully." });
  } catch (ex) {
    next(ex);
  }
};

module.exports.votePoll = async (req, res, next) => {
    try {
        const { messageId, optionId, userId } = req.body;
        const message = await Message.findById(messageId);
        
        if (!message || message.type !== 'poll') {
            return res.status(404).json({ msg: "Poll not found" });
        }

        if (!message.pollData.multipleAnswers) {
            message.pollData.options.forEach(opt => {
                opt.votes = opt.votes.filter(id => id.toString() !== userId);
            });
        }

        const option = message.pollData.options.id(optionId);
        if(option && !option.votes.includes(userId)) {
            option.votes.push(userId);
        }

        await message.save();
        return res.json({ msg: "Vote recorded", pollData: message.pollData });
    } catch (ex) { 
        next(ex); 
    }
};

// Phase 2: Enhanced View-Once logic for groups
module.exports.triggerViewOnce = async (req, res, next) => {
    try {
        const { messageId, userId } = req.body;
        const message = await Message.findById(messageId);
        
        if(!message) return res.status(404).json({ msg: "Message not found" });

        message.viewed = true;
        if (userId && !message.viewedBy.includes(userId)) {
            message.viewedBy.push(userId);
        }
        await message.save();

        return res.json({ msg: "Media marked as viewed." });
    } catch (ex) { 
        next(ex); 
    }
};

module.exports.toggleStarMessage = async (req, res, next) => {
    try {
        const { messageId, userId } = req.body;
        const message = await Message.findById(messageId);
        
        if(!message) return res.status(404).json({ msg: "Message not found" });

        const isStarred = message.starredBy.includes(userId);
        
        if (isStarred) {
            message.starredBy = message.starredBy.filter(id => id.toString() !== userId);
        } else {
            message.starredBy.push(userId);
        }

        await message.save();
        return res.json({ msg: "Star status updated", isStarred: !isStarred });
    } catch (ex) { 
        next(ex); 
    }
};