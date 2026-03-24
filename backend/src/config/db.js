import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer = null;

export async function connectDb({ mongodbUri, useInMemoryDb = false }) {
  mongoose.set('strictQuery', true);

  if (useInMemoryDb) {
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri();
    await mongoose.connect(uri);
    console.log('[growsim-backend] connected to in-memory MongoDB');
    return;
  }

  if (!mongodbUri) {
    throw new Error('MONGODB_URI missing and USE_INMEMORY_DB is not enabled');
  }

  await mongoose.connect(mongodbUri);
  console.log('[growsim-backend] connected to MongoDB');
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
