const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      min: 3,
      max: 50, 
    },
    description: {
      type: String,
      default: "",
    },
    avatarImage: {
      type: String,
      default: "", 
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", 
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    groupKeys: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        encryptedKey: { type: String, required: true } 
      }
    ],
    inviteCode: {
      type: String,
      unique: true,
      sparse: true 
    },
    
    // --- ADVANCED ROLES & PERMISSIONS ---
    moderators: [
      { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      }
    ],
    bannedUsers: [ // <-- NEW: Prevent kicked users from re-joining
      {
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      }
    ],
    isChannel: { 
        type: Boolean, 
        default: false // If true, only Admins and Mods can send messages
    },
    isPublic: { 
        type: Boolean, 
        default: false // If true, anyone can search and join without an invite
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Group", GroupSchema);