'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Lightweight SQLite migrations for existing volumes (add columns without wiping data).
 */
function ensureBucketArnColumn() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/storage_manager.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dbPath)) return;

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return;
  }

  const db = new Database(dbPath);
  try {
    const cols = db.prepare('PRAGMA table_info(buckets)').all();
    if (cols.length && !cols.some((c) => c.name === 'arn')) {
      db.exec('ALTER TABLE buckets ADD COLUMN arn TEXT');
    }
  } finally {
    db.close();
  }
}

function ensureBucketSystemColumns() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/storage_manager.db');
  if (!fs.existsSync(dbPath)) return;

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return;
  }

  const db = new Database(dbPath);
  try {
    const cols = db.prepare('PRAGMA table_info(buckets)').all();
    if (cols.length) {
      if (!cols.some((c) => c.name === 'system_id')) {
        db.exec('ALTER TABLE buckets ADD COLUMN system_id TEXT');
      }
      if (!cols.some((c) => c.name === 'base_path')) {
        db.exec('ALTER TABLE buckets ADD COLUMN base_path TEXT');
      }
    }
  } finally {
    db.close();
  }
}

module.exports = { ensureBucketArnColumn, ensureBucketSystemColumns };
