const mongoose = require('mongoose');
const config = require('../config');
const { seedDemoData } = require('./seed');

let connectionPromise = null;

async function openDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const conn = await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 8000,
      });
      console.log(`Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);

      if (config.seedDemo) {
        try {
          await seedDemoData();
        } catch (seedErr) {
          console.warn('Seed demo error (ignored):', seedErr.message);
        }
      }

      return conn.connection;
    } catch (error) {
      console.error('MongoDB connection error:', error.message);
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

module.exports = {
  openDatabase,
  closeDatabase,
  getDatabase: openDatabase,
};
