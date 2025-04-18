import mongoose from 'mongoose';
import { IUser } from './User';

export interface IAdvisorMessage extends mongoose.Document {
  user: mongoose.Types.ObjectId | IUser;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const advisorMessageSchema = new mongoose.Schema<IAdvisorMessage>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for efficient message retrieval
advisorMessageSchema.index({ user: 1, createdAt: -1 });

export const AdvisorMessage = mongoose.models.AdvisorMessage || mongoose.model<IAdvisorMessage>('AdvisorMessage', advisorMessageSchema); 