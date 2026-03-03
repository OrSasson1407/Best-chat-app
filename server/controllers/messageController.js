const Message = require("../models/Message"); 
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

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
        message: msg.isDeleted ? "🚫 This message was deleted" : msg.message.text,
        type: msg.type,
        createdAt: msg.createdAt,
        status: msg.status || "sent", 
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
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
    const { from, to, message, type, replyTo } = req.body;
    let finalContent = message;

    // INTERCEPT: If the message type is media and it comes as a base64 string, upload to Cloudinary
    if (["image", "video", "audio", "file"].includes(type) && message.startsWith("data:")) {
      const uploadRes = await cloudinary.uploader.upload(message, {
        resource_type: "auto", // Automatically detect if it's an image, video, or raw file
        folder: "best_chat_app_media", // Keeps your Cloudinary dashboard organized
      });
      finalContent = uploadRes.secure_url; // Overwrite base64 string with the public URL
    }

    const data = await Message.create({
      message: { text: finalContent },
      users: [from, to],
      sender: from,
      type: type || "text",
      replyTo: replyTo || null,
      status: "sent" 
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