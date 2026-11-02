const config = require('./config');
const app = require('./app');
const { openDatabase, closeDatabase } = require('./db');

openDatabase();

const server = app.listen(config.port, () => {
  console.log(`Groundwork API listening on http://localhost:${config.port}`);
  console.log(`API docs: http://localhost:${config.port}/api/docs`);
});

function shutdown(signal) {
  console.log(`\n${signal} received. Closing the server...`);
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
