const path = require('path');
const fs = require('fs');
const Record = require('aerekos-record');

let db = null;

function resolveDbPath() {
  return process.env.DATABASE_PATH || path.join(__dirname, '../../data/storage_manager.db');
}

function ensureConnected() {
  if (db) {
    return db;
  }
  const dbPath = resolveDbPath();
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  db = Record.connect('sqlite', {
    database: dbPath,
    readonly: false,
    fileMustExist: false,
    timeout: 5000
  });
  return db;
}

async function getDatabase() {
  return ensureConnected();
}

module.exports = { getDatabase };
