'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Lightweight SQLite migrations for existing volumes (add columns without wiping data).
 * Mirrors worker/storage_manager/api/utils/migrations.js.
 *
 * Columns added on the fly (no-op if the table is missing or the column already exists):
 *   DownloadList.system_id   -> target is a *system* bucket (not project-scoped)
 *   DownloadItem.system_id   -> copied from the list so completion knows the target
 *   DownloadItem.qbt_hash    -> qBittorrent infohash for magnet/torrent_url items
 */
const COLUMN_SPECS = [
  { table: 'downloadlist', column: 'system_id', type: 'TEXT' },
  { table: 'downloaditem', column: 'system_id', type: 'TEXT' },
  { table: 'downloaditem', column: 'qbt_hash', type: 'TEXT' },
];

function ensureDownloadColumns() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/download_manager.db');
  if (!fs.existsSync(dbPath)) return;

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return;
  }

  const db = new Database(dbPath);
  try {
    for (const spec of COLUMN_SPECS) {
      const cols = db.prepare(`PRAGMA table_info(${spec.table})`).all();
      if (cols.length && !cols.some((c) => c.name === spec.column)) {
        db.exec(`ALTER TABLE ${spec.table} ADD COLUMN ${spec.column} ${spec.type}`);
      }
    }
  } finally {
    db.close();
  }
}

// Backwards-compatible export name used by older call sites.
function ensureSystemIdColumns() {
  return ensureDownloadColumns();
}

module.exports = { ensureDownloadColumns, ensureSystemIdColumns };
