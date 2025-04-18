import mongoose from 'mongoose';
import { User, Party, Message } from '@/models';
import { AdvisorMessage } from '@/models/AdvisorMessage';
import { Destination } from '@/models/Destination';

// Register models
const registerModels = () => {
  if (!mongoose.models.User) {
    mongoose.model('User', User.schema);
  }
  if (!mongoose.models.Party) {
    mongoose.model('Party', Party.schema);
  }
  if (!mongoose.models.Message) {
    mongoose.model('Message', Message.schema);
  }
  if (!mongoose.models.AdvisorMessage) {
    mongoose.model('AdvisorMessage', AdvisorMessage.schema);
  }
  if (!mongoose.models.Destination) {
    mongoose.model('Destination', Destination.schema);
  }
};

declare global {
  var mongooseInstance: {
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global.mongooseInstance) {
  global.mongooseInstance = {
    promise: null,
  };
}

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside .env.local'
    );
  }

  if (!global.mongooseInstance.promise) {
    const opts = {
      bufferCommands: true,
    };

    global.mongooseInstance.promise = mongoose.connect(process.env.MONGODB_URI, opts);
  }

  try {
    await global.mongooseInstance.promise;
    // Register models after connection is established
    registerModels();
    return mongoose;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
} 