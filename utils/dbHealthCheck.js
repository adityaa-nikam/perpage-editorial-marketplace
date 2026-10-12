import mongoose from 'mongoose';
import { ATLAS_DIRECT_URI } from '../config/db.js';

/**
 * Check database connection health
 * @returns {Object} Health status and connection info
 */
export const checkDatabaseHealth = () => {
  const readyStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const state = mongoose.connection.readyState;
  const isHealthy = state === 1;

  return {
    isHealthy,
    state: readyStates[state] || 'unknown',
    stateCode: state,
    host: mongoose.connection.host || 'N/A',
    name: mongoose.connection.name || 'N/A',
    collections: mongoose.connection.collections ? Object.keys(mongoose.connection.collections).length : 0
  };
};

/**
 * Attempt to reconnect to database with retry logic
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<boolean>} Success status
 */
export const attemptReconnect = async (maxRetries = 3, retryDelay = 5000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Database reconnection attempt ${attempt}/${maxRetries}`);
      
      if (mongoose.connection.readyState === 1) {
        console.log('✅ Database already connected');
        return true;
      }

      if (mongoose.connection.readyState === 0) {
        const uri = process.env.MONGO_URL || process.env.MONGO_URI || ATLAS_DIRECT_URI;
        try {
          await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
            maxPoolSize: 10,
          });
        } catch (initialErr) {
          await mongoose.connect(ATLAS_DIRECT_URI, {
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
            maxPoolSize: 10,
          });
        }
      }

      // Wait for connection to be established
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 15000);

        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });

        mongoose.connection.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      console.log('✅ Database reconnected successfully');
      return true;

    } catch (error) {
      console.error(`❌ Reconnection attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting ${retryDelay/1000} seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error(`❌ All ${maxRetries} reconnection attempts failed`);
  return false;
};

/**
 * Monitor database connection and attempt reconnection if needed
 */
export const startDatabaseMonitor = () => {
  console.log('🔍 Starting database connection monitor...');
  
  const checkInterval = 30000; // Check every 30 seconds
  
  setInterval(async () => {
    const health = checkDatabaseHealth();
    
    if (!health.isHealthy && health.state === 'disconnected') {
      console.warn('⚠️ Database disconnected, attempting reconnection...');
      await attemptReconnect(2, 3000); // 2 attempts with 3 second delay
    }
  }, checkInterval);
};
