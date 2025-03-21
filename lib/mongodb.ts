import mongoose from 'mongoose';

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
    return mongoose;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
} 