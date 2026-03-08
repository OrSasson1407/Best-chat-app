const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      min: 3,
      max: 50, // Expanded max length slightly
    },
    description: {
      type: String,
      default: "",
    },
    avatarImage: {
      type: String,
      default: "", // Can store Cloudinary URL for group icons
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Fixed reference to match your User.js model
      },
    ],
    // --- MERGE UPDATE: Support multiple admins ---
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // --- MERGE UPDATE: STEP 14 GROUP E2EE ---
    groupKeys: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        encryptedKey: { type: String, required: true } // The AES key encrypted with this specific user's RSA Public Key
      }
    ],
    inviteCode: {
      type: String,
      unique: true,
      sparse: true // Allows nulls but keeps strings unique
    }
  },
  {
    timestamps: true,
  }
);

// Changed export name to singular 'Group' to follow conventions and match the controller
module.exports = mongoose.model("Group", GroupSchema);