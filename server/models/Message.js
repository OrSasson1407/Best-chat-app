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
      // NEW: Added 'poll' and 'link' to the allowed types
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

    // --- NEW FEATURE FIELDS ---
    
    // 1. Message Forwarding
    isForwarded: { 
        type: Boolean, 
        default: false 
    },
    
    // 2. Self-Destructing Media (View Once)
    isViewOnce: { 
        type: Boolean, 
        default: false 
    },
    viewed: { 
        type: Boolean, 
        default: false // Turns true after the recipient opens it
    },
    
    // 3. Pinned and Starred
    isPinned: { 
        type: Boolean, 
        default: false 
    },
    starredBy: [
        { type: mongoose.Schema.Types.ObjectId, ref: "User" } // Array of users who starred this
    ], 
    
    // 4. Polls & Decisions
    pollData: {
      question: { type: String },
      options: [{ 
          text: String, 
          votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }] 
      }],
      multipleAnswers: { type: Boolean, default: false }
    },

    // 5. Rich Link Previews
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

module.exports = mongoose.model("Message", MessageSchema);