import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URL, { serverSelectionTimeoutMS: 5000 });
  console.log('[db] conectado');
}

export function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}
