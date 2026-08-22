import mongoose, { Document, Schema } from 'mongoose';

export interface IChunk extends Document {
  repoUrl: string;
  filePath: string;
  fileSha?: string;
  content: string;
  embedding: number[];
}

const ChunkSchema: Schema = new Schema({
  repoUrl: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSha: { type: String }, // Optional for backward compatibility, but set on new/updated chunks
  content: { type: String, required: true },
  // Vector search requires the embedding to be an Array of Numbers
  embedding: { type: [Number], required: true },
}, { timestamps: true });

ChunkSchema.index({ repoUrl: 1, filePath: 1 });

export default mongoose.model<IChunk>('Chunk', ChunkSchema);
