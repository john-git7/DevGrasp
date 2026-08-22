import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRepoStatus extends Document {
  repoUrl: string;
  users: Types.ObjectId[];
  status: 'indexing' | 'complete' | 'error' | 'paused' | 'quota_wait';
  totalFiles: number;
  indexedFiles: number;
  excludedExtensions: string[];
  excludedFiles: string[];
  currentFile: string | null;
  waitTime: number;
  lastUpdated: Date;
}

const repoStatusSchema: Schema = new Schema({
  repoUrl: { type: String, required: true, unique: true },
  users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['indexing', 'complete', 'error', 'paused', 'quota_wait'], default: 'indexing' },
  totalFiles: { type: Number, default: 0 },
  indexedFiles: { type: Number, default: 0 },
  excludedExtensions: [{ type: String }],
  excludedFiles: [{ type: String }],
  currentFile: { type: String, default: null },
  waitTime: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model<IRepoStatus>('RepoStatus', repoStatusSchema);
