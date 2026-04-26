const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema(
  {
    // BUG-006 FIX: min/max are Number-type validators and are silently ignored
    // on String fields. The correct String validators are minlength/maxlength.
    name: { type: String, required: true, minlength: 3, maxlength: 50 },
    description: { type: String, default: "" },
    avatarImage:  { type: String, default: "" },

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admins:  [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],

    groupKeys: [
      {
        userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        encryptedKey: { type: String, required: true },
      },
    ],

    inviteCode: { type: String, unique: true, sparse: true },

    // --- ADVANCED ROLES & PERMISSIONS ---
    moderators:  [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    isChannel: { type: Boolean, default: false },
    isPublic:  { type: Boolean, default: false },

    // =============================================================
    // SPRINT 3 NEW FIELDS
    // =============================================================

    // --- GROUP RULES (Sprint 3) ---
    // Admins can set rules that are pinned at the top of the chat window
    rules: { type: String, default: "", maxlength: 1000 },

    // --- MAX MEMBER LIMIT (Sprint 3) ---
    // 0 = unlimited. When set, joining is blocked once the cap is reached.
    maxMembers: { type: Number, default: 0, min: 0 },

    // --- QR INVITE LINK (Sprint 3) ---
    // A signed, shareable invite link used for QR code generation
    inviteLinkEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Performance & Search Indexes
GroupSchema.index({ members: 1 });
GroupSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Group", GroupSchema);