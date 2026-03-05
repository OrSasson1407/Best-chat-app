const Message = require("../models/Message"); 
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const urlMetadata = require('url-metadata'); // For Rich Link Previews

// --- LEVEL 4: ENTERPRISE BACKGROUND QUEUE ---
// We no longer import Firebase directly here. The worker handles it!
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

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    const messages = await Message.find({
      users: { $all: [from, to] },
    })
      .sort({ updatedAt: 1 })
      .populate("replyTo", "message.text sender type isDeleted");

    const projectedMessages = messages.map((msg) => {
      // Hide content if it's a view-once media that was already viewed by the recipient
      const isHiddenViewOnce = msg.isViewOnce && msg.viewed && msg.sender.toString() !== from;

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
        viewed: msg.viewed,
        isPinned: msg.isPinned,
        isStarred: msg.starredBy.includes(from),
        pollData: msg.pollData,
        linkMetadata: msg.linkMetadata,

        replyTo: msg.replyTo ? {
            id: msg.replyTo._id,
            text: msg.replyTo.isDeleted ? "🚫 This message was deleted" : msg.replyTo.message.text,
            type: msg.replyTo.type,
            isSelfQuote: msg.replyTo.sender.toString() === from
        } : null,
        reactions: msg.reactions || [],
      };
    });
    res.json(projectedMessages);
  } catch (ex) {
    next(ex);
  }
};

module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, to, message, type, replyTo, isForwarded, isViewOnce, pollData } = req.body;

    // --- BLOCK LOGIC ENFORCEMENT ---
    const receiver = await User.findById(to);
    if (receiver && receiver.blockedUsers.includes(from)) {
      // Return 403 to indicate they are blocked and cannot send messages to this user
      return res.status(403).json({ msg: "Cannot send message. You are blocked by this user." });
    }

    let finalContent = message;
    let linkMetadata = null;
    let finalType = type || "text";

    // 1. INTERCEPT: Media Uploads (Base64 -> Cloudinary)
    if (["image", "video", "audio", "file"].includes(type) && message.startsWith("data:")) {
      const uploadRes = await cloudinary.uploader.upload(message, {
        resource_type: "auto", 
        folder: "best_chat_app_media", 
      });
      finalContent = uploadRes.secure_url; 
    }

    // 2. INTERCEPT: Rich Link Previews
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

    const data = await Message.create({
      message: { text: finalContent },
      users: [from, to],
      sender: from,
      type: finalType,
      replyTo: replyTo || null,
      status: "sent",
      
      isForwarded: isForwarded || false,
      isViewOnce: isViewOnce || false,
      pollData: pollData || null,
      linkMetadata: linkMetadata
    });

    // --- LEVEL 4: OFFLINE PUSH NOTIFICATIONS VIA BACKGROUND QUEUE ---
    // If user is not online via socket (tracked in global.onlineUsers), queue a push notification
    if (!global.onlineUsers.has(to) && receiver && receiver.fcmToken) {
       try {
         const senderUser = await User.findById(from);
         
         // Dispatch the job to BullMQ instantly
         await notificationQueue.add("send_fcm_message", {
           userId: receiver._id,
           fcmToken: receiver.fcmToken,
           title: `New message from ${senderUser.username}`,
           body: finalType === "text" ? "Sent a message" : `Sent a ${finalType}`,
         }, {
           attempts: 3, // Enterprise feature: Automatically retry 3 times if Firebase is down
           backoff: {
             type: 'exponential',
             delay: 1000, // Wait 1s, 2s, 4s between retries
           }
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
    
    // Toggle reaction
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

module.exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    // SECURITY CHECK: Ensure only the original sender can delete the message
    if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Unauthorized action: You can only delete your own messages." });
    }

    // Mark as deleted, overwrite text, clear reactions/metadata
    message.isDeleted = true;
    message.message.text = "🚫 This message was deleted";
    message.reactions = []; 
    message.linkMetadata = null;
    message.pollData = null;
    await message.save();

    return res.json({ msg: "Message deleted successfully." });
  } catch (ex) {
    next(ex);
  }
};

module.exports.editMessage = async (req, res, next) => {
  try {
    const { messageId, newText } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    // SECURITY CHECK: Ensure only the original sender can edit the message
    if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Unauthorized action: You can only edit your own messages." });
    }

    // Prevent editing of deleted or view-once messages
    if (message.isDeleted) return res.status(400).json({ msg: "Cannot edit a deleted message" });
    if (message.isViewOnce) return res.status(400).json({ msg: "Cannot edit a view-once message" });

    message.message.text = newText;
    message.isEdited = true;
    
    // Re-evaluate Link Previews on Edit
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

        // Remove user's previous votes if multipleAnswers is false
        if (!message.pollData.multipleAnswers) {
            message.pollData.options.forEach(opt => {
                opt.votes = opt.votes.filter(id => id.toString() !== userId);
            });
        }

        // Add new vote
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

module.exports.triggerViewOnce = async (req, res, next) => {
    try {
        const { messageId } = req.body;
        const message = await Message.findById(messageId);
        
        if(!message) return res.status(404).json({ msg: "Message not found" });

        message.viewed = true;
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