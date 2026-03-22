const Message = require("../models/Message"); 
const messageService = require("../services/messageService");
const urlMetadata = require('url-metadata'); // Needed for editMessage rich link previews
const { scheduledMessageQueue } = require("../workers/messageScheduler"); // BullMQ integration

// STEP 1 FIX: Import Meilisearch Message Index
const { messageIndex } = require("../utils/meilisearch");

// Helper to detect URLs in text for link previews
const extractUrls = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex);
};

/* =========================================================
   FEATURE: Global "Fuzzy" Message Search (Meilisearch)
   ========================================================= */
module.exports.searchMessages = async (req, res, next) => {
  try {
    const { userId, query } = req.body;

    if (!query || query.trim() === "") {
        return res.json({ status: true, messages: [] });
    }

    let messageIds = [];

    try {
      // 1. Attempt ultra-fast fuzzy search via Meilisearch
      // We filter by 'users' so people can only search their own chats
      const searchResults = await messageIndex.search(query, {
        filter: `users = '${userId}'`, 
        limit: 30,
      });

      messageIds = searchResults.hits.map(hit => hit.id);
    } catch (meiliErr) {
      console.warn("[Meilisearch] Message search failed, falling back to MongoDB:", meiliErr.message);
    }

    let messages = [];

    if (messageIds.length > 0) {
      // 2A. If Meilisearch worked, fetch the full documents from DB (to get reactions, metadata, etc.)
      const unsortedMessages = await Message.find({ _id: { $in: messageIds } });
      
      // Map them back into the exact relevance order returned by Meilisearch
      messages = messageIds
        .map(id => unsortedMessages.find(m => m._id.toString() === id.toString()))
        .filter(Boolean); // Remove nulls
    } else {
      // 2B. Fallback to MongoDB traditional text search if Meili is down or returns 0 results
      messages = await Message.find({
        users: { $in: [userId] },
        $text: { $search: query }
      }).sort({ score: { $meta: "textScore" } }).limit(20);
    }
    
    return res.json({ status: true, messages });
  } catch (ex) {
    next(ex);
  }
};

/* =========================================================
   In-App Media Gallery Fetcher
   ========================================================= */
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
        isDeleted: false, 
        deletedFor: { $ne: from } 
    };

    const messages = await Message.find(query).sort({ _id: -1 });

    const mediaList = messages.map((msg) => {
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
        fileMetadata: msg.fileMetadata 
      };
    }).filter(msg => msg.message !== "💣 Media Expired"); 

    res.json({ status: true, media: mediaList });
  } catch (ex) {
    next(ex);
  }
};

/* =========================================================
   Infinite Scrolling Pagination
   ========================================================= */
module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to, cursor, limit = 50 } = req.body; 
    const result = await messageService.fetchMessages(from, to, cursor, limit);
    res.json(result);
  } catch (ex) {
    next(ex);
  }
};

/* =========================================================
   Add Message (Delegated to Service Layer + BullMQ + Meili)
   ========================================================= */
module.exports.addMessage = async (req, res, next) => {
  try {
    const data = await messageService.processAndSaveMessage(req.body);
    
    if (data) {
        // BullMQ: Schedule message for the future
        if (data.scheduledAt && data.status === "pending") {
            const delayMs = new Date(data.scheduledAt).getTime() - Date.now();
            if (delayMs > 0) {
                await scheduledMessageQueue.add("send_scheduled", 
                    { messageId: data._id }, 
                    { delay: delayMs }
                );
            }
        } else if (data.type === 'text') {
            // MEILISEARCH: Sync standard text messages instantly to the search index
            try {
                await messageIndex.addDocuments([{
                    id: data._id.toString(),
                    text: data.message.text,
                    users: data.users.map(u => u.toString()), // Array of users allowed to see this
                    sender: data.sender.toString(),
                    createdAt: new Date(data.createdAt).getTime()
                }]);
            } catch (err) {
                console.warn("[Meilisearch] Failed to index new message:", err.message);
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

    const userReactionIndex = message.reactions.findIndex(r => r.by.toString() === userId.toString());
    
    if (userReactionIndex > -1) {
        if (message.reactions[userReactionIndex].emoji === emoji) {
            message.reactions.splice(userReactionIndex, 1);
        } else {
            message.reactions[userReactionIndex].emoji = emoji;
        }
    } else {
        message.reactions.push({ emoji, by: userId, username });
    }

    await message.save();
    return res.json({ msg: "Reaction updated", reactions: message.reactions });
  } catch (ex) {
    next(ex);
  }
};

/* =========================================================
   Delete Message for Everyone
   ========================================================= */
module.exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    const requestingUserId = req.user?.id || req.body.userId;
    if (message.sender.toString() !== requestingUserId.toString()) {
        return res.status(403).json({ msg: "Unauthorized action: You can only delete your own messages." });
    }

    message.isDeleted = true;
    message.message.text = "🚫 This message was deleted";
    message.reactions = []; 
    message.linkMetadata = null;
    message.fileMetadata = null; 
    message.pollData = null;
    await message.save();

    // MEILISEARCH: Remove deleted messages from the global search index
    try {
        await messageIndex.deleteDocument(messageId.toString());
    } catch (err) {
        console.warn("[Meilisearch] Failed to delete message from index:", err.message);
    }

    return res.json({ msg: "Message deleted successfully." });
  } catch (ex) {
    next(ex);
  }
};

/* =========================================================
   Delete for Me
   ========================================================= */
module.exports.deleteMessageForMe = async (req, res, next) => {
  try {
    const { messageId, userId } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    if (!message.deletedFor) message.deletedFor = [];
    
    if (!message.deletedFor.some(id => id.toString() === userId.toString())) {
        message.deletedFor.push(userId);
        await message.save();
    }

    return res.json({ msg: "Message deleted for you." });
  } catch (ex) {
    next(ex);
  }
};

/* =========================================================
   Edit Message
   ========================================================= */
module.exports.editMessage = async (req, res, next) => {
  try {
    const { messageId, newText } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

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

    // MEILISEARCH: Update the edited text in the search engine
    try {
        await messageIndex.updateDocuments([{ id: messageId.toString(), text: newText }]);
    } catch (err) {
        console.warn("[Meilisearch] Failed to update edited message in index:", err.message);
    }

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
                opt.votes = opt.votes.filter(id => id.toString() !== userId.toString());
            });
        }

        const option = message.pollData.options.id(optionId);
        if (option && !option.votes.some(id => id.toString() === userId.toString())) {
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
        const { messageId, userId } = req.body;
        const message = await Message.findById(messageId);
        
        if(!message) return res.status(404).json({ msg: "Message not found" });

        message.viewed = true;
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

        const isStarred = message.starredBy && message.starredBy.some(id => id.toString() === userId.toString());
        
        if (isStarred) {
            message.starredBy = message.starredBy.filter(id => id.toString() !== userId.toString());
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