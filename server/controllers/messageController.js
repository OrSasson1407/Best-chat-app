const Message = require("../models/Message"); // Updated to match the model export name

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    const messages = await Message.find({
      users: { $all: [from, to] },
    })
      .sort({ updatedAt: 1 })
      .populate("replyTo", "message.text sender type");

    const projectedMessages = messages.map((msg) => {
      return {
        id: msg._id,
        fromSelf: msg.sender.toString() === from,
        message: msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt,
        status: msg.status || "sent", // FIX: Pull status from DB so ticks survive refresh
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