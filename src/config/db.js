import mongoose from 'mongoose';

const readyStateMap = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

export async function connectDb({ mongodbUri }) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(mongodbUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10
  });
}

export async function disconnectDb() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

export function getDbState() {
  const { readyState, host, name } = mongoose.connection;

  return {
    readyState,
    status: readyStateMap[readyState] ?? 'unknown',
    host: host || null,
    database: name || null
  };
}
