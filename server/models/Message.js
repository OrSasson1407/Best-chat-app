const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  status: { type: String, default: 'sent' },
  isDeleted: { type: Boolean, default: false } 
}, { timestamps: true });

// ?? High Impact: Indexes preventing full collection scans
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 }); // Added for Shared Content Side Panel
messageSchema.index(
  { isDeleted: 1 },
  { partialFilterExpression: { isDeleted: false } }
);

module.exports = mongoose.model('Message', messageSchema);
