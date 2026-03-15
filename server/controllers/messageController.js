const Message = require("../models/Message"); 
const messageService = require("../services/messageService");
const urlMetadata = require('url-metadata'); // Needed for editMessage rich link previews
const { scheduledMessageQueue } = require("../workers/messageScheduler"); // ADDED: BullMQ integration

// Helper to detect URLs in text for link previews
const extractUrls = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex);
};

// --- FEATURE: Search Messages ---
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

    // Use _id for sorting instead of createdAt for better performance and consistency
    const messages = await Message.find(query).sort({ _id: -1 });

    const mediaList = messages.map((msg) => {
      // FIX: Use .some() and .toString() to prevent Mongoose ObjectId comparison bugs
      const hasViewedBy = msg.viewedBy && msg.viewedBy.some(id => id.toString() === from.toString());
      const hasViewed = msg.viewed || hasViewedBy;
      const isHiddenViewOnce = msg.isViewOnce && hasViewed && msg.sender.toString() !== from.toString();

      return {
        id: msg._id,
        fromSelf: msg.sender.toString() === from.toString(),
        message: isHiddenViewOnce ? "💣 Media Expired" : msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt, 
        isViewOnce: msg.isViewOnce,
        viewed: hasViewed,
        linkMetadata: msg.linkMetadata,
        fileMetadata: msg.fileMetadata // Expose to Gallery
      };
    }).filter(msg => msg.message !== "💣 Media Expired"); // Completely hide expired view-once media

    res.json({
        status: true,
        media: mediaList
    });
  } catch (ex) {
    next(ex);
  }
};

// --- FEATURE: Infinite Scrolling & Phase 2 Scheduled Message Filter ---
module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to, cursor, limit = 50 } = req.body; 
    
    // Delegate the complex querying and formatting to the Service Layer
    const result = await messageService.fetchMessages(from, to, cursor, limit);
    res.json(result);
  } catch (ex) {
    next(ex);
  }
};

// --- Add Message (Delegated to Service Layer + BullMQ Scheduler) ---
module.exports.addMessage = async (req, res, next) => {
  try {
    // Delegate Cloudinary uploads, URL metadata, saving, and Notifications to the Service Layer
    const data = await messageService.processAndSaveMessage(req.body);
    
    if (data) {
        // IMPROVEMENT: If the message is scheduled for the future, send it to the BullMQ worker
        if (data.scheduledAt && data.status === "pending") {
            const delayMs = new Date(data.scheduledAt).getTime() - Date.now();
            if (delayMs > 0) {
                await scheduledMessageQueue.add("send_scheduled", 
                    { messageId: data._id }, 
                    { delay: delayMs }
                );
            }
        }

        return res.json({ msg: "Message added successfully.", data });
    } else {
        return res.status(400).json({ msg: "Failed to add message" });
    }
  } catch (ex) {
    if (ex.message === "Cannot send message. You are blocked by this user.") {
        return res.status(403).json({ msg: ex.message });
    }
    next(ex);
  }
};

module.exports.reactToMessage = async (req, res, next) => {
  try {
    const { messageId, emoji, userId, username } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    // FIX: Check if user already reacted. If they did, update the emoji instead of pushing duplicates.
    const userReactionIndex = message.reactions.findIndex(r => r.by.toString() === userId.toString());
    
    if (userReactionIndex > -1) {
        if (message.reactions[userReactionIndex].emoji === emoji) {
            // Same emoji clicked again -> Remove reaction (toggle off)
            message.reactions.splice(userReactionIndex, 1);
        } else {
            // Different emoji clicked -> Update reaction
            message.reactions[userReactionIndex].emoji = emoji;
        }
    } else {
        // New reaction
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

    // FIX: Safe check for user ID depending on how your auth middleware maps it
    const requestingUserId = req.user?.id || req.body.userId;
    if (message.sender.toString() !== requestingUserId.toString()) {
        return res.status(403).json({ msg: "Unauthorized action: You can only delete your own messages." });
    }

    message.isDeleted = true;
    message.message.text = "🚫 This message was deleted";
    message.reactions = []; 
    message.linkMetadata = null;
    message.fileMetadata = null; // clear on delete
    message.pollData = null;
    await message.save();

    return res.json({ msg: "Message deleted successfully." });
  } catch (ex) {
    next(ex);
  }
};

// --- Delete for Me Controller ---
module.exports.deleteMessageForMe = async (req, res, next) => {
  try {
    const { messageId, userId } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    // Initialize array if it doesn't exist in the older schema records
    if (!message.deletedFor) message.deletedFor = [];
    
    // FIX: Use .some() instead of .includes() for ObjectIds
    if (!message.deletedFor.some(id => id.toString() === userId.toString())) {
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

    // FIX: Safe check for user ID
    const requestingUserId = req.user?.id || req.body.userId;
    if (message.sender.toString() !== requestingUserId.toString()) {
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
            } catch (err) { 
                message.linkMetadata = null; 
                message.type = "text"; 
            }
        } else {
            message.linkMetadata = null; 
            message.type = "text";
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
                opt.votes = opt.votes.filter(id => id.toString() !== userId.toString()); // FIX: .toString()
            });
        }

        const option = message.pollData.options.id(optionId);
        // FIX: Use .some() instead of .includes() for ObjectIds
        if (option && !option.votes.some(id => id.toString() === userId.toString())) {
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
        // FIX: Use .some() instead of .includes() for ObjectIds
        if (userId && !message.viewedBy.some(id => id.toString() === userId.toString())) {
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

        // FIX: Use .some() instead of .includes() for ObjectIds
        const isStarred = message.starredBy && message.starredBy.some(id => id.toString() === userId.toString());
        
        if (isStarred) {
            message.starredBy = message.starredBy.filter(id => id.toString() !== userId.toString()); // FIX: .toString()
        } else {
            if (!message.starredBy) message.starredBy = [];
            message.starredBy.push(userId);
        }

        await message.save();
        return res.json({ msg: "Star status updated", isStarred: !isStarred });
    } catch (ex) { 
        next(ex); 
    }
};