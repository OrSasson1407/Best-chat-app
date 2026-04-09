// server/models/Story.js
const mongoose = require("mongoose");

const StorySchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  mediaUrl: { 
    type: String, 
    required: false // Optional if it's a text-only storyy
  },
  mediaType: { 
    type: String, 
    enum: ["image", "video", "text"], 
    default: "image" 
  },
  textContent: { 
    type: String, 
    default: "" 
  }, // For text stories or captions
  backgroundColor: { 
    type: String, 
    default: "#000000" 
  }, // Background for text-only stories
  viewers: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      viewedAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 86400 // MAGIC: MongoDB will automatically delete this document after 24 hours (86400 seconds)
  }
});

// Index to quickly fetch stories from specific users
StorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Story", StorySchema);