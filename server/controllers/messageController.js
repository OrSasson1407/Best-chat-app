const Message = require("../models/Message"); // Updated to match the model export name

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    const messages = await Message.find({
      users: { $all: [from, to] },
    })
      .sort({ updatedAt: 1 })
      .populate("replyTo", "message.text sender type isDeleted");

    const projectedMessages = messages.map((msg) => {
      return {
        id: msg._id,
        fromSelf: msg.sender.toString() === from,
        // Mask the message text if it was deleted
        message: msg.isDeleted ? "🚫 This message was deleted" : msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt,
        status: msg.status || "sent", // Pull status from DB so ticks survive refresh
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
        replyTo: msg.replyTo ? {
            id: msg.replyTo._id,
            // Mask the quoted text if the original was deleted
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
    const { from, to, message, type, replyTo } = req.body;
    const data = await Message.create({
      message: { text: message },
      users: [from, to],
      sender: from,
      type: type || "text",
      replyTo: replyTo || null,
      status: "sent" // New messages default to sent
    });

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
    
    // Toggle reaction: if it exists, remove it; if not, add it
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

// NEW: Delete Message Controller
module.exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    // Mark as deleted, overwrite text, and clear reactions
    message.isDeleted = true;
    message.message.text = "🚫 This message was deleted";
    message.reactions = []; 
    await message.save();

    return res.json({ msg: "Message deleted successfully." });
  } catch (ex) {
    next(ex);
  }
};

// NEW: Edit Message Controller
module.exports.editMessage = async (req, res, next) => {
  try {
    const { messageId, newText } = req.body;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    // Prevent editing of already deleted messages
    if (message.isDeleted) return res.status(400).json({ msg: "Cannot edit a deleted message" });

    message.message.text = newText;
    message.isEdited = true;
    await message.save();

    return res.json({ msg: "Message edited successfully." });
  } catch (ex) {
    next(ex);
  }
};