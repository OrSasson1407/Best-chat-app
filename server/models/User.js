const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, minlength: 3, maxlength: 20, unique: true },
  email:    { type: String, required: true, unique: true, maxlength: 50 },
  password: { type: String, required: true, minlength: 8 },
  gender:   { type: String, enum: ["male", "female"], default: "male" },

  isAvatarImageSet: { type: Boolean, default: false },
  avatarImage:      { type: String, default: "" },

  // --- REAL-TIME PRESENCE ---
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },

  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  statusMessage: { type: String, default: "Available", maxlength: 50 },
  statusIcon:    { type: String, default: "💬" },
  bio:           { type: String, default: "Hey there! I am using Snappy.", maxlength: 150 },
  interests:     { type: [String], default: [] },

  // --- PRIVACY CONTROLS ---
  privacySettings: {
    lastSeen:      { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
    readReceipts:  { type: Boolean, default: true },
    profilePhoto:  { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
  },

  // --- NOTIFICATIONS ---
  fcmTokens: { type: [String], default: [] },

  // --- E2E ENCRYPTION ---
  e2eStatus: {
    hasKeys: { type: Boolean, default: false },
    enabled: { type: Boolean, default: false },
  },
  e2eKeys: {
    identityKey:    { type: mongoose.Schema.Types.Mixed, default: "" },
    registrationId: { type: Number, default: 0 },
    signedPreKey: {
      keyId:     { type: Number },
      publicKey: { type: mongoose.Schema.Types.Mixed },
      signature: { type: String },
    },
    preKeys: [{ keyId: { type: Number }, publicKey: { type: mongoose.Schema.Types.Mixed } }],
  },

  // --- TWO-FACTOR AUTHENTICATION (Sprint 1) ---
  twoFactor: {
    enabled:     { type: Boolean, default: false },
    secret:      { type: String, default: "" },
    backupCodes: { type: [String], default: [] },
  },

  // --- ARCHIVED CHATS (Sprint 1) ---
  archivedChats: [{ type: mongoose.Schema.Types.ObjectId }],

  // --- ONBOARDING (Sprint 3) ---
  // Set to true after user completes the first-time walkthrough
  onboardingDone: { type: Boolean, default: false },

  // --- FRIEND / CONTACT REQUEST SYSTEM (Sprint 2) ---
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [
    {
      from:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
      sentAt: { type: Date, default: Date.now },
    },
  ],

  // --- MUTE NOTIFICATIONS PER CHAT (Sprint 2) ---
  mutedChats: [
    {
      chatId: { type: mongoose.Schema.Types.ObjectId },
      until:  { type: Date },
    },
  ],

  // --- CHAT FOLDERS (Sprint 2) ---
  chatFolders: [
    {
      name:    { type: String, maxlength: 30 },
      icon:    { type: String, default: "📁" },
      chatIds: [{ type: mongoose.Schema.Types.ObjectId }],
    },
  ],

  // --- CHAT CUSTOMIZATIONS ---
  chatCustomizations: [
    {
      chatId:     { type: mongoose.Schema.Types.ObjectId },
      wallpaper:  { type: String, default: "" },
      themeColor: { type: String, default: "" },
    },
  ],
});

userSchema.index({ username: "text", bio: "text" });

module.exports = mongoose.model("User", userSchema);