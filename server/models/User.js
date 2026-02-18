const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }, // הוספנו את זה!
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  status: { type: String, default: "Available" },
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);