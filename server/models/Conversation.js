const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  repoId: { type: String, required: true }, // URL of the repo (e.g. github.com/user/repo)
  title: { type: String, required: true },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now }
});

conversationSchema.index({ repoId: 1, createdAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
