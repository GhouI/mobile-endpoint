import mongoose from 'mongoose';
import { IUser } from './User';

export interface IParty extends mongoose.Document {
  location: string;
  description: string;
  estimatedPrice: number;
  maxParticipants: number;
  currentParticipants: number;
  owner: mongoose.Types.ObjectId | IUser;
  participants: (mongoose.Types.ObjectId | IUser)[];
  status: 'open' | 'full' | 'closed';
  additionalFields: Record<string, any>;
  imageUrl?: string;
  isGlobal: boolean;
  coordinates?: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  createdAt: Date;
  updatedAt: Date;
}

const partySchema = new mongoose.Schema<IParty>(
  {
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    estimatedPrice: {
      type: Number,
      required: [true, 'Estimated price is required'],
      min: [0, 'Price cannot be negative'],
    },
    maxParticipants: {
      type: Number,
      required: [true, 'Maximum participants is required'],
      min: [1, 'Must allow at least 1 participant'],
    },
    currentParticipants: {
      type: Number,
      default: 1,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    status: {
      type: String,
      enum: ['open', 'full', 'closed'],
      default: 'open',
    },
    additionalFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    imageUrl: {
      type: String,
    },
    isGlobal: {
      type: Boolean,
      default: false,
      required: true,
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Create a 2dsphere index for location-based queries
partySchema.index({ coordinates: '2dsphere' });

// Update status when participants change
partySchema.pre('save', function(next) {
  if (this.currentParticipants >= this.maxParticipants) {
    this.status = 'full';
  } else if (this.status !== 'closed') {
    this.status = 'open';
  }
  next();
});

export const Party = mongoose.models.Party || mongoose.model<IParty>('Party', partySchema); 