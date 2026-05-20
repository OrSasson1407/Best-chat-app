const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  status: { type: String, default: 'sent' }
}, { timestamps: true });

// 🔥 High Impact: Compound index prevents full collection scans when fetching chat history
messageSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
