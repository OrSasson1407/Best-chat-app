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
      enum: ["text", "image", "video", "audio", "file", "code", "poll", "link"],
      default: "text",
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message", 
      default: null,
    },
    reactions: [
      {
        emoji: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: String,
      },
    ],
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isForwarded: { 
        type: Boolean, 
        default: false 
    },
    isViewOnce: { 
        type: Boolean, 
        default: false 
    },
    viewed: { 
        type: Boolean, 
        default: false 
    },
    isPinned: { 
        type: Boolean, 
        default: false 
    },
    starredBy: [
        { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ], 
    pollData: {
      question: { type: String },
      options: [{ 
          text: String, 
          votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }] 
      }],
      multipleAnswers: { type: Boolean, default: false }
    },
    linkMetadata: {
      title: String,
      description: String,
      image: String,
      url: String
    }
  },
  {
    timestamps: true,
  }
);

// Performance & Search Indexes
MessageSchema.index({ users: 1, createdAt: -1 }); // Fast conversation retrieval
MessageSchema.index({ "message.text": "text" }); // Enables keyword search in chats

module.exports = mongoose.model("Message", MessageSchema);