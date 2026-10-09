import mongoose from 'mongoose';
import {expressError} from '../utils/expressErrors.js';
import {asyncWrap} from '../utils/wrapAsync.js';

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log(process.env.MONGO_URL);
    
    // Set connection timeout and retry options
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 10, // Maintain up to 10 socket connections
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // Handle specific connection errors
    if (error.name === 'MongooseServerSelectionError') {
      console.error('❌ Cannot reach MongoDB server. Please check:');
      console.error('   - Internet connection');
      console.error('   - MongoDB Atlas network access');
      console.error('   - MongoDB service status');
    } else if (error.name === 'MongooseTimeoutError') {
      console.error('❌ MongoDB connection timeout. Check network connectivity.');
    }
    
    throw new expressError(`MongoDB connection failed: ${error.message}`, 500);
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
 