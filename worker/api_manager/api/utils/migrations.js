'use strict';

const path = require('path');
const fs = require('fs');

const NEW_COLS = [
  ['target_service', 'TEXT'],
  ['target_path', 'TEXT'],
  ['resource_arn_template', 'TEXT'],
  ['required_scope', 'TEXT'],
  ['enabled', 'INTEGER'],
  ['resolve_arn_at', 'TEXT'],
  ['desired', 'INTEGER'],
];

const DATA_API_COLS = [
  ['engine', 'TEXT'],
  ['desired', 'INTEGER'],
  ['autoscaling', 'TEXT'],
];

function ensureApiRouteColumns() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/api_manager.db');
  if (!fs.existsSync(dbPath)) return;

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return;
  }

  const db = new Database(dbPath);
  try {
    const table = 'apiroutes';
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.length) return;
    const names = new Set(cols.map((c) => c.name));
    for (const [name, type] of NEW_COLS) {
      if (!names.has(name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      }
    }
    const dataCols = db.prepare('PRAGMA table_info(dataapis)').all();
    if (dataCols.length) {
      const dataNames = new Set(dataCols.map((c) => c.name));
      for (const [name, type] of DATA_API_COLS) {
        if (!dataNames.has(name)) {
          db.exec(`ALTER TABLE dataapis ADD COLUMN ${name} ${type}`);
        }
      }
    }
  } finally {
    db.close();
  }
}

module.exports = { ensureApiRouteColumns };
