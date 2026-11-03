const mongoose = require('mongoose');
const config = require('../config');
const { seedDemoData } = require('./seed');

let isConnected = false;

async function openDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);

    if (config.seedDemo) {
      await seedDemoData();
    }

    return conn.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
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
