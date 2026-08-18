const mongoose = require('mongoose');

const ChunkSchema = new mongoose.Schema({
  repoUrl: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSha: { type: String }, // Optional for backward compatibility, but set on new/updated chunks
  content: { type: String, required: true },
  // Vector search requires the embedding to be an Array of Numbers
  embedding: { type: [Number], required: true },
}, { timestamps: true });

ChunkSchema.index({ repoUrl: 1, filePath: 1 });

module.exports = mongoose.model('Chunk', ChunkSchema);
