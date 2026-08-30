const path = require('path');
const fs = require('fs');
const Record = require('aerekos-record');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'conductor.db');

// Set SQLITE_VERBOSE to empty string to prevent adapter from setting verbose=false
// (better-sqlite3 expects function or undefined, not boolean false)
process.env.SQLITE_VERBOSE = process.env.SQLITE_VERBOSE || '';

const db = Record.connect('sqlite', {
  database: dbPath,
  logQueries: process.env.NODE_ENV === 'development',
  verbose: process.env.SQLITE_VERBOSE === 'true' ? console.log : undefined
});

module.exports = db;
