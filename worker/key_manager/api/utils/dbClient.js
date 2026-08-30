const path = require('path');
const fs = require('fs');
const Record = require('aerekos-record');

// For key_manager, we use SQLite directly (small, local database)
// Other services will use db_manager to create databases
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/key_manager.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = Record.connect('sqlite', {
  database: dbPath,
  readonly: false,
  fileMustExist: false,
  timeout: 5000
  // verbose omitted - better-sqlite3 expects it to be a function or undefined
});

module.exports = db;
