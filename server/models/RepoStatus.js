const mongoose = require('mongoose');

const repoStatusSchema = new mongoose.Schema({
  repoUrl: { type: String, required: true, unique: true },
  status: { type: String, enum: ['indexing', 'complete', 'error'], default: 'indexing' },
  totalFiles: { type: Number, default: 0 },
  indexedFiles: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RepoStatus', repoStatusSchema);
