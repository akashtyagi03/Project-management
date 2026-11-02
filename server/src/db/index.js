const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');
const { seedDemoData } = require('./seed');

let db;

function openDatabase() {
  if (db) return db;

  if (config.dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  }

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  if (config.seedDemo) {
    seedDemoData(db);
  }

  return db;
}

function closeDatabase() {
  if (!db) return;
  db.close();
  db = undefined;
}

module.exports = { openDatabase, closeDatabase, getDatabase: openDatabase };
