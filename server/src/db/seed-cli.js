process.env.SEED_DEMO = 'false';

const { openDatabase, closeDatabase } = require('./index');
const { seedDemoData } = require('./seed');

const db = openDatabase();
const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;

if (userCount > 0) {
  console.log('Database already has data. Nothing to seed.');
  console.log('Delete the database file first if you want a clean demo dataset.');
} else {
  seedDemoData(db);
  console.log('Demo data created.');
  console.log('Sign in with admin@groundwork.dev / Admin@123');
  console.log('or priya@groundwork.dev / Manager@123');
}

closeDatabase();
