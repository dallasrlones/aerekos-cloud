const path = require('path');
const fs = require('fs');
const Record = require('aerekos-record');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/waf_manager.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = Record.connect('sqlite', { database: dbPath, readonly: false, fileMustExist: false, timeout: 5000 });
module.exports = db;
