const { openDatabase, closeDatabase } = require('./index');
const { seedDemoData } = require('./seed');
const { User } = require('../models');

async function run() {
  await openDatabase();
  const userCount = await User.countDocuments();

  if (userCount > 0) {
    console.log('MongoDB already has data. Nothing to seed.');
  } else {
    await seedDemoData();
    console.log('Demo data created.');
    console.log('Sign in with admin@groundwork.dev / Admin@123');
    console.log('or priya@groundwork.dev / Manager@123');
  }

  await closeDatabase();
}

run().catch((err) => {
  console.error('Seed error:', err.message);
  process.exit(1);
});
