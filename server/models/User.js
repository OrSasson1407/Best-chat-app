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

  // --- MERGE UPDATE: PRIVACY CONTROLS ---
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
  
  // --- NEW FEATURES ---
  fcmToken: { 
    type: String, 
    default: "" 
  },
  publicKey: { 
    type: String, 
    default: "" 
  },

  // --- MERGE UPDATE: CHAT CUSTOMIZATIONS ---
  chatCustomizations: [
    {
      chatId: { type: mongoose.Schema.Types.ObjectId }, // Can be a User ID or Group ID
      wallpaper: { type: String, default: "" }, // URL or hex code
      themeColor: { type: String, default: "" } // Custom accent color
    }
  ]
});

module.exports = mongoose.model("User", userSchema);