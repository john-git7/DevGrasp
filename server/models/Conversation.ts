import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IConversation extends Document {
  userId: Types.ObjectId;
  repoId: string;
  title: string;
  messages: IMessage[];
  createdAt: Date;
}

const messageSchema: Schema = new Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const conversationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  repoId: { type: String, required: true }, // URL of the repo (e.g. github.com/user/repo)
  title: { type: String, required: true },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now }
});

conversationSchema.index({ repoId: 1, createdAt: -1 });

export default mongoose.model<IConversation>('Conversation', conversationSchema);
