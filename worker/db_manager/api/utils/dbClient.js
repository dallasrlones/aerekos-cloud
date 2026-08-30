const path = require('path');
const fs = require('fs');
const Record = require('aerekos-record');

// For db_manager, we use SQLite directly for metadata (small, local database)
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/db_manager.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbConnection = Record.connect('sqlite', {
  database: dbPath
});

// The dbConnection object already has a healthCheck method from aerekos-record
// Export it as 'db' for compatibility with existing code
const db = dbConnection;

module.exports = db;
