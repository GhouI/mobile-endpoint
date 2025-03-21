import mongoose from 'mongoose';
import { IUser } from './User';
import { IParty } from './Party';

export interface IMessage extends mongoose.Document {
  content: string;
  sender: mongoose.Types.ObjectId | IUser;
  party: mongoose.Types.ObjectId | IParty;
  recipient?: mongoose.Types.ObjectId | IUser; // For private messages
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new mongoose.Schema<IMessage>(
  {
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient message queries
messageSchema.index({ party: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

export const Message = mongoose.models.Message || mongoose.model<IMessage>('Message', messageSchema); 