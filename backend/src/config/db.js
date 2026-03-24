import mongoose from 'mongoose';

export async function connectDb({ mongodbUri }) {
  mongoose.set('strictQuery', true);

  if (!mongodbUri) {
    throw new Error('MONGODB_URI missing');
  }

  await mongoose.connect(mongodbUri);
  console.log('[growsim-backend] connected to MongoDB');
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
