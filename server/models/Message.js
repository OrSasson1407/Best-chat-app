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
    type: {
      type: String,
      default: "text",
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message", // This requires the model to be named exactly "Message"
      default: null,
    },
    reactions: [
      {
        emoji: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: String,
      },
    ],
    // WhatsApp-style status tracking
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
  },
  {
    timestamps: true,
  }
);

// FIX: Exported as "Message" instead of "Messages" to prevent Mongoose crash!
module.exports = mongoose.model("Message", MessageSchema);