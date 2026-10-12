import dns from 'node:dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}
import 'dotenv/config';

import mongoose from 'mongoose';
import {expressError} from '../utils/expressErrors.js';
import {asyncWrap} from '../utils/wrapAsync.js';

// Direct replica set fallback URI (bypasses Windows querySrv DNS issues)
export const ATLAS_DIRECT_URI = 'mongodb://adityanikamdev_db_user:Xcfl7ecERR69tk5t@ac-xesbgvm-shard-00-00.m7hocq8.mongodb.net:27017,ac-xesbgvm-shard-00-01.m7hocq8.mongodb.net:27017,ac-xesbgvm-shard-00-02.m7hocq8.mongodb.net:27017/perpage?ssl=true&replicaSet=atlas-jzjk6f-shard-0&authSource=admin&retryWrites=true&w=majority';

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URL || process.env.MONGO_URI || ATLAS_DIRECT_URI;
  
  try {
    console.log('Attempting to connect to MongoDB...');
    try {
      dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1']);
    } catch (e) {}
    
    // Set connection timeout and retry options
    const conn = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      maxPoolSize: 10,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`⚠️ Primary MongoDB connection failed (${error.message}). Trying direct replica set fallback...`);
    
    try {
      const fallbackConn = await mongoose.connect(ATLAS_DIRECT_URI, {
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        maxPoolSize: 10,
      });
      console.log(`✅ MongoDB Connected via direct replica set: ${fallbackConn.connection.host}`);
      return fallbackConn;
    } catch (fallbackError) {
      console.error('❌ MongoDB connection failed:', fallbackError.message);
      throw new expressError(`MongoDB connection failed: ${fallbackError.message}`, 500);
    }
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB connection error:', error.message);
});

export default connectDB;
 