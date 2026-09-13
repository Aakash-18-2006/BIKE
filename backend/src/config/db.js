import mongoose from 'mongoose';
import { CONFIG } from './env.js';

let mongodInstance = null;

export async function connectDB() {
  try {
    // First attempt connecting to configured MONGO_URI
    mongoose.set('strictQuery', false);
    
    // Quick test connection with 2 second timeout
    await mongoose.connect(CONFIG.MONGO_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[Database] Connected to external MongoDB at ${CONFIG.MONGO_URI}`);
  } catch (err) {
    if (CONFIG.USE_MEMORY_DB) {
      console.log('[Database] Local MongoDB unreachable. Spinning up embedded MongoMemoryServer...');
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create({
          instance: { dbName: 'smart_bike' },
        });
        const memoryUri = mongodInstance.getUri();
        await mongoose.connect(memoryUri);
        console.log(`[Database] Embedded in-memory MongoDB running at ${memoryUri}`);
      } catch (memErr) {
        console.error('[Database] Failed to start MongoMemoryServer:', memErr.message);
        throw memErr;
      }
    } else {
      console.error('[Database] MongoDB connection failed:', err.message);
      throw err;
    }
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
}
