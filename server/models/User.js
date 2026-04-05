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

  // --- E2E STATUS TRACKING ---
  // Tracks whether a user has valid E2E keys, enabling safe fallback for legacy accounts
  e2eStatus: {
    hasKeys: { type: Boolean, default: false },
    enabled: { type: Boolean, default: false },
  },

  // --- FULL E2EE PRE-KEY BUNDLE ---
  // Keys stored as Mixed so Mongoose accepts both raw JWK objects and JSON-stringified
  // JWK strings. parseJwk() on the frontend handles both forms transparently.
  e2eKeys: {
    identityKey: { type: mongoose.Schema.Types.Mixed, default: "" }, // JWK object or JSON string
    registrationId: { type: Number, default: 0 }, 
    signedPreKey: {
      keyId: { type: Number },
      publicKey: { type: mongoose.Schema.Types.Mixed },
      signature: { type: String }
    },
    preKeys: [ // A batch of one-time use keys for perfect forward secrecy
      {
        keyId: { type: Number },
        publicKey: { type: mongoose.Schema.Types.Mixed }
      }
    ]
  },

  // --- TWO-FACTOR AUTHENTICATION ---
  twoFactor: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, default: "" },        // TOTP secret (store encrypted in prod)
    backupCodes: { type: [String], default: [] },  // One-time backup codes
  },

  // --- ARCHIVED CHATS (Sprint 1) ---
  archivedChats: [{ type: mongoose.Schema.Types.ObjectId }],

  // --- ONBOARDING ---
  onboardingDone: { type: Boolean, default: false },

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