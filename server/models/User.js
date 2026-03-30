const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    minlength: 3,    
    maxlength: 20,   
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    maxlength: 50,   
  },
  password: {
    type: String,
    required: true,
    minlength: 8,    
  },
  gender: {
    type: String,
    enum: ["male", "female"],
    default: "male",
  },
  isAvatarImageSet: {
    type: Boolean,
    default: false,
  },
  avatarImage: {
    type: String,
    default: "",
  },
  
  // --- REAL-TIME PRESENCE ---
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },

  blockedUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  statusMessage: {
    type: String,
    default: "Available",
    maxlength: 50,   
  },
  statusIcon: {
    type: String,
    default: "💬", 
  },
  bio: {
    type: String,
    default: "Hey there! I am using Snappy.",
    maxlength: 150,  
  },
  interests: {
    type: [String],
    default: [],
  },

  // --- PRIVACY CONTROLS ---
  privacySettings: {
    lastSeen: { 
      type: String, 
      enum: ["everyone", "contacts", "nobody"], 
      default: "everyone" 
    },
    readReceipts: { 
      type: Boolean, 
      default: true 
    },
    profilePhoto: { 
      type: String, 
      enum: ["everyone", "contacts", "nobody"], 
      default: "everyone" 
    }
  },
  
  // --- NOTIFICATIONS ---
  // FIX: Converted from a single string to an array to support multiple devices (phone, desktop, tablet)
  fcmTokens: { 
    type: [String], 
    default: [] 
  },

  // --- FULL E2EE PRE-KEY BUNDLE ---
  // Replaced the old single `publicKey` with a full bundle required for Signal-like E2EE
  e2eKeys: {
    identityKey: { type: String, default: "" }, // Long-term public identity key
    registrationId: { type: Number, default: 0 }, 
    signedPreKey: {
      keyId: { type: Number },
      publicKey: { type: String },
      signature: { type: String }
    },
    preKeys: [ // A batch of one-time use keys for perfect forward secrecy
      {
        keyId: { type: Number },
        publicKey: { type: String }
      }
    ]
  },

  // --- CHAT CUSTOMIZATIONS ---
  chatCustomizations: [
    {
      chatId: { type: mongoose.Schema.Types.ObjectId }, // Can be a User ID or Group ID
      wallpaper: { type: String, default: "" }, // URL or hex code
      themeColor: { type: String, default: "" } // Custom accent color
    }
  ]
});

// ==========================================
// Performance & Search Indexes
// ==========================================

// 1. Enables fast keyword search for discovering users
userSchema.index({ username: "text", bio: "text" });

module.exports = mongoose.model("User", userSchema);