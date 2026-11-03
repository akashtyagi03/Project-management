const config = require('./config');
const app = require('./app');
const { openDatabase, closeDatabase } = require('./db');

async function start() {
  try {
    await openDatabase();
  } catch (err) {
    console.warn('\n⚠️ MongoDB is not connected yet. Please configure MONGODB_URI in your .env file.\n');
  }

  const server = app.listen(config.port, () => {
    console.log(`Project Management API listening on http://localhost:${config.port}`);
    console.log(`API docs: http://localhost:${config.port}/api/docs`);
  });

  function shutdown(signal) {
    console.log(`\n${signal} received. Closing the server...`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
