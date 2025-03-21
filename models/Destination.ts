import mongoose from 'mongoose';

interface IAttraction {
  name: string;
  description: string;
  iconUrl: string;
}

export interface IDestination extends mongoose.Document {
  name: string;
  shortDescription: string;
  longDescription: string;
  bannerUrl: string;
  weather: {
    average: string;
    description: string;
  };
  currency: {
    code: string;
    name: string;
    symbol: string;
  };
  languages: {
    name: string;
    code: string;
  }[];
  attractions: IAttraction[];
  createdAt: Date;
  updatedAt: Date;
}

const attractionSchema = new mongoose.Schema<IAttraction>({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  iconUrl: {
    type: String,
    required: true,
  },
});

const destinationSchema = new mongoose.Schema<IDestination>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    shortDescription: {
      type: String,
      required: true,
    },
    longDescription: {
      type: String,
      required: true,
    },
    bannerUrl: {
      type: String,
      required: true,
    },
    weather: {
      average: {
        type: String,
        required: true,
      },
      description: {
        type: String,
        required: true,
      },
    },
    currency: {
      code: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      symbol: {
        type: String,
        required: true,
      },
    },
    languages: [{
      name: {
        type: String,
        required: true,
      },
      code: {
        type: String,
        required: true,
      },
    }],
    attractions: [attractionSchema],
  },
  {
    timestamps: true,
  }
);

// Create text indexes for search
destinationSchema.index({ 
  name: 'text', 
  shortDescription: 'text', 
  'attractions.name': 'text' 
});

export const Destination = mongoose.models.Destination || mongoose.model<IDestination>('Destination', destinationSchema); 