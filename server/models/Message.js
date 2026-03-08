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

    // --- MERGE UPDATE: Critical Bug Fix ---
    // This allows users to delete messages locally without deleting for everyone
    deletedFor: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ],

    isEdited: {
      type: Boolean,
      default: false,
    },
    isForwarded: { 
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
    },

    // --- MERGE UPDATE: Step 11 File Metadata ---
    fileMetadata: {
      fileName: String,
      fileSize: String,
      publicId: String // Useful if you ever want to delete files from Cloudinary
    },

    // ==========================================
    // PHASE 2: PRODUCTIVITY & PRIVACY 
    // ==========================================
    
    isViewOnce: { 
        type: Boolean, 
        default: false 
    },
    viewed: { 
        type: Boolean, 
        default: false 
    },
    viewedBy: [
        { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ], // Enhanced for group tracking

    timer: { 
        type: Number, 
        default: null 
    }, // e.g., 3600 seconds (1 hour)
    expireAt: { 
        type: Date, 
        default: null 
    }, // Triggers MongoDB Auto-Deletion

    scheduledAt: { 
        type: Date, 
        default: null 
    }, 
    isSent: { 
        type: Boolean, 
        default: true 
    }, // False if scheduled for the future

    // ==========================================
    // NEW: ADVANCED READ RECEIPTS
    // ==========================================
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: { type: String }, 
        readAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true,
  }
);

// ==========================================
// Performance & Search Indexes
// ==========================================

// 1. Fast conversation retrieval
MessageSchema.index({ users: 1, createdAt: -1 }); 

// 2. Enables fast keyword search in chats
MessageSchema.index({ "message.text": "text" }); 

// 3. Speeds up queries for finding messages sent by a specific user
MessageSchema.index({ sender: 1 }); 

// 4. PHASE 2 MAGIC TRICK: MongoDB TTL Index. 
// MongoDB will automatically delete documents from the DB when the `expireAt` time is reached.
MessageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Message", MessageSchema);