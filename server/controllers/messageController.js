const Messages = require("../models/Message");

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    // Fetch messages and populate the 'replyTo' field so we can show quoted text
    const messages = await Messages.find({
      users: { $all: [from, to] },
    })
      .sort({ updatedAt: 1 })
      .populate("replyTo", "message.text sender type"); // Bring in replied message details

    const projectedMessages = messages.map((msg) => {
      return {
        id: msg._id, // Needed for reacting/replying
        fromSelf: msg.sender.toString() === from,
        message: msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt,
        replyTo: msg.replyTo ? {
            text: msg.replyTo.message.text,
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
    const data = await Messages.create({
      message: { text: message },
      users: [from, to],
      sender: from,
      type: type || "text",
      replyTo: replyTo || null, // Save quoted message ID
    });

    if (data) return res.json({ msg: "Message added successfully.", data });
    else return res.json({ msg: "Failed to add message" });
  } catch (ex) {
    next(ex);
  }
};

// NEW: Controller to handle reacting to a message
module.exports.reactToMessage = async (req, res, next) => {
  try {
    const { messageId, emoji, userId, username } = req.body;
    
    // Find message and add reaction
    const message = await Messages.findById(messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });

    // Check if user already reacted with this emoji, if so, remove it (toggle)
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