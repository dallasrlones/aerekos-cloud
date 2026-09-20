'use strict';

const path = require('path');
const fs = require('fs');

const AI_MODEL_COLUMNS = [
  ['capability', 'TEXT'],
  ['endpoint', 'TEXT'],
  ['secret_ref', 'TEXT'],
  ['is_default', 'TEXT'],
  ['enabled', 'TEXT'],
  ['arn', 'TEXT'],
];

const MEMORY_STORE_COLUMNS = [
  ['name', 'TEXT'],
  ['arn', 'TEXT'],
];

function openDb() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/ai_manager.db');
  if (!fs.existsSync(dbPath)) return null;
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return null;
  }
  return new Database(dbPath);
}

function addMissingColumns(db, table, columns) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!tables) return;
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
  for (const [name, type] of columns) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
}

function ensureAiModelConfigColumns() {
  const db = openDb();
  if (!db) return;
  try {
    addMissingColumns(db, 'aimodelconfigs', AI_MODEL_COLUMNS);
    addMissingColumns(db, 'memorystoreconfigs', MEMORY_STORE_COLUMNS);
    addMissingColumns(db, 'intelligenceendpoints', [['balancer_id', 'TEXT'], ['model', 'TEXT'], ['execution', 'TEXT'], ['queue_name', 'TEXT']]);
    addMissingColumns(db, 'agentasks', [['from_layer', 'TEXT'], ['speak_text', 'TEXT'], ['kind', 'TEXT'], ['payload', 'TEXT']]);
    addMissingColumns(db, 'agentworkers', [
      ['messages_json', 'TEXT'], ['retry_count', 'TEXT'], ['replan_count', 'TEXT'], ['chunk_grant', 'TEXT'],
    ]);
    addMissingColumns(db, 'agentmessages', [['ask_id', 'TEXT']]);
    addMissingColumns(db, 'agentsettings', [
      ['workspace_worker_id', 'TEXT'], ['write_policy', 'TEXT'], ['notify_on_done', 'TEXT'], ['browser_url', 'TEXT'],
    ]);
    addMissingColumns(db, 'agents', [['notify_on_done', 'TEXT']]);
    addMissingColumns(db, 'agentcrons', [
      ['kind', 'TEXT'], ['run_at', 'TEXT'], ['timezone', 'TEXT'], ['last_error', 'TEXT'],
    ]);
    try {
      db.exec(`UPDATE memorystoreconfigs SET name = 'default' WHERE name IS NULL OR name = ''`);
      db.exec(`UPDATE memorystoreconfigs SET arn = 'arn:aerekos:' || project_id || ':ai:memory:store/default' WHERE (arn IS NULL OR arn = '') AND project_id IS NOT NULL`);
      db.exec(`CREATE INDEX IF NOT EXISTS "memorystoreconfigs_name_idx" ON "memorystoreconfigs" ("name")`);
    } catch {
      /* table may not exist yet */
    }
  } finally {
    db.close();
  }
}

module.exports = { ensureAiModelConfigColumns };
