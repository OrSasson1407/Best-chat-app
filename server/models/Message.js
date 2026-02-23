const mongoose = require("mongoose");

const MessageSchema = mongoose.Schema(
  {
    message: {
      text: { type: String, required: true },
    },
    users: Array,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Supports: "text", "image", "audio", "code"
    type: {
      type: String,
      default: "text",
    },
    // NEW: For message replies (quoting)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Messages",
      default: null,
    },
    // NEW: For emoji reactions
    reactions: [
      {
        emoji: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: String, // Store username for easy frontend display
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Messages", MessageSchema);