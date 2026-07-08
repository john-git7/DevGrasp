const mongoose = require('mongoose');

const repoStatusSchema = new mongoose.Schema({
  repoUrl: { type: String, required: true, unique: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['indexing', 'complete', 'error', 'paused', 'quota_wait'], default: 'indexing' },
  totalFiles: { type: Number, default: 0 },
  indexedFiles: { type: Number, default: 0 },
  excludedExtensions: [{ type: String }],
  excludedFiles: [{ type: String }],
  currentFile: { type: String, default: null },
  waitTime: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RepoStatus', repoStatusSchema);
