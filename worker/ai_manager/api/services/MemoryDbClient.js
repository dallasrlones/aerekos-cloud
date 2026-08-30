const axios = require('axios');
const Record = require('aerekos-record');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DEFAULT_VECTOR_DIM = 384;

/**
 * Cross-worker memory data plane — db_manager HTTP API, with local fallback for tests.
 */
class MemoryDbClient {
  constructor(env = process.env) {
    this.conductorUrl = (env.CONDUCTOR_URL || '').replace(/\/$/, '');
    this.serviceToken = env.SERVICE_TOKEN || '';
    this.fallback = env.MEMORY_DB_FALLBACK === '1' || env.MEMORY_DB_FALLBACK === 'true';
    this.fallbackRoot = env.MEMORY_DB_FALLBACK_PATH || path.join(os.tmpdir(), 'aerekos-memory-fallback');
    this._fallbackState = new Map();
  }

  dbApiBase() {
    if (!this.conductorUrl) {
      throw Object.assign(new Error('CONDUCTOR_URL required for memory db access'), { status: 503 });
    }
    return `${this.conductorUrl}/api/services/db_manager/api`;
  }

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.serviceToken) h.Authorization = `Bearer ${this.serviceToken}`;
    return h;
  }

  async createDatabase(projectId, name, type, workerId) {
    if (this.fallback) return this._fallbackCreate(projectId, name, type);
    const url = `${this.dbApiBase()}/databases?project_id=${encodeURIComponent(projectId)}`;
    const { data } = await axios.post(url, { name, type, worker_id: workerId || undefined }, { headers: this.headers() });
    return data;
  }

  async vectorUpsert(projectId, dbName, body) {
    if (this.fallback) return this._fallbackVectorUpsert(projectId, dbName, body);
    const url = `${this.dbApiBase()}/databases/${encodeURIComponent(dbName)}/vectors/upsert?project_id=${encodeURIComponent(projectId)}`;
    const { data } = await axios.post(url, body, { headers: this.headers() });
    return data;
  }

  async vectorSearch(projectId, dbName, body) {
    if (this.fallback) return this._fallbackVectorSearch(projectId, dbName, body);
    const url = `${this.dbApiBase()}/databases/${encodeURIComponent(dbName)}/vectors/search?project_id=${encodeURIComponent(projectId)}`;
    const { data } = await axios.post(url, body, { headers: this.headers() });
    return data;
  }

  async vectorDelete(projectId, dbName, body) {
    if (this.fallback) return this._fallbackVectorDelete(projectId, dbName, body);
    const url = `${this.dbApiBase()}/databases/${encodeURIComponent(dbName)}/vectors?project_id=${encodeURIComponent(projectId)}`;
    const { data } = await axios.delete(url, { data: body, headers: this.headers() });
    return data;
  }

  async memorySql(projectId, dbName, body) {
    if (this.fallback) return this._fallbackMemorySql(projectId, dbName, body);
    const url = `${this.dbApiBase()}/databases/${encodeURIComponent(dbName)}/memory/sql?project_id=${encodeURIComponent(projectId)}`;
    const { data } = await axios.post(url, body, { headers: this.headers() });
    return data;
  }

  async memorySchema(projectId, dbName) {
    if (this.fallback) return this._fallbackMemorySchema(projectId, dbName);
    const url = `${this.dbApiBase()}/databases/${encodeURIComponent(dbName)}/memory/schema?project_id=${encodeURIComponent(projectId)}`;
    const { data } = await axios.post(url, {}, { headers: this.headers() });
    return data;
  }

  _fallbackKey(projectId, dbName) {
    return `${projectId}:${dbName}`;
  }

  _ensureSqliteMemorySchema(db) {
    if (typeof Record.registerMemoryModels === 'function') {
      Record.registerMemoryModels(db);
      return;
    }
    db.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_sessions (
        id TEXT PRIMARY KEY, session_id TEXT, user_id TEXT, created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS st_messages (
        id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT, user_id TEXT,
        role TEXT, content TEXT, seq INTEGER, created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS st_chunks (
        id TEXT PRIMARY KEY, session_id TEXT, user_id TEXT, text TEXT,
        importance REAL, source_message_ids TEXT, created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS lt_summaries (
        id TEXT PRIMARY KEY, user_id TEXT, session_id TEXT, text TEXT, created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS lt_facts (
        id TEXT PRIMARY KEY, user_id TEXT, fact TEXT, source_chunk_id TEXT, created_at TEXT
      );
    `);
    const raw = db.db;
    for (const stmt of [
      'ALTER TABLE st_chunks ADD COLUMN importance REAL',
      'ALTER TABLE st_chunks ADD COLUMN source_message_ids TEXT',
      'ALTER TABLE lt_summaries ADD COLUMN session_id TEXT',
      'ALTER TABLE lt_facts ADD COLUMN fact TEXT',
      'ALTER TABLE lt_facts ADD COLUMN source_chunk_id TEXT',
    ]) {
      try { raw.exec(stmt); } catch (_) { /* column exists */ }
    }
  }

  _fallbackPaths(projectId, dbName, type) {
    const dir = path.join(this.fallbackRoot, projectId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (type === 'lancedb') {
      return path.join(dir, `${dbName}.lancedb`);
    }
    return path.join(dir, `${dbName}.db`);
  }

  async _fallbackCreate(projectId, name, type) {
    const key = this._fallbackKey(projectId, name);
    const dbPath = this._fallbackPaths(projectId, name, type);
    if (type === 'sqlite3') {
      const db = Record.connect('sqlite', { database: dbPath });
      this._ensureSqliteMemorySchema(db);
      await db.close();
      this._fallbackState.set(key, { type, path: dbPath });
    } else if (type === 'lancedb') {
      this._fallbackState.set(key, { type, path: dbPath, rows: [] });
      return { name, type, status: 'running', metadata: JSON.stringify({ database: dbPath, memory: true }) };
    }
    return { name, type, status: 'running', metadata: JSON.stringify({ database: dbPath }) };
  }

  async _fallbackMemorySchema(projectId, dbName) {
    const key = this._fallbackKey(projectId, dbName);
    const entry = this._fallbackState.get(key);
    if (!entry || entry.type !== 'sqlite3') throw new Error(`sqlite store '${dbName}' not found`);
    const db = Record.connect('sqlite', { database: entry.path });
    this._ensureSqliteMemorySchema(db);
    await db.close();
    return { schema: 'memory_v1' };
  }

  async _fallbackMemorySql(projectId, dbName, { op, sql, params = [] }) {
    const key = this._fallbackKey(projectId, dbName);
    const entry = this._fallbackState.get(key);
    if (!entry || entry.type !== 'sqlite3') throw new Error(`sqlite store '${dbName}' not found`);
    const db = Record.connect('sqlite', { database: entry.path });
    try {
      if (op === 'query') {
        const stmt = db.db.prepare(sql);
        const rows = params.length ? stmt.all(...params) : stmt.all();
        return { rows, rowCount: rows.length };
      }
      const stmt = db.db.prepare(sql);
      const result = params.length ? stmt.run(...params) : stmt.run();
      return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
    } finally {
      await db.close();
    }
  }

  async _fallbackVectorUpsert(projectId, dbName, body) {
    const key = this._fallbackKey(projectId, dbName);
    const entry = this._fallbackState.get(key);
    if (!entry || entry.type !== 'lancedb') throw new Error(`lancedb store '${dbName}' not found`);
    if (typeof Record.connectLance === 'function') {
      const lance = Record.connectLance({ database: entry.path, vectorDim: body.vector_dim || DEFAULT_VECTOR_DIM });
      return lance.upsert(body.rows, { vector_dim: body.vector_dim || DEFAULT_VECTOR_DIM });
    }
    entry.rows = entry.rows || [];
    for (const row of body.rows || []) entry.rows.push(row);
    return { upserted: (body.rows || []).length };
  }

  async _fallbackVectorSearch(projectId, dbName, body) {
    const key = this._fallbackKey(projectId, dbName);
    const entry = this._fallbackState.get(key);
    if (!entry || entry.type !== 'lancedb') throw new Error(`lancedb store '${dbName}' not found`);
    if (typeof Record.connectLance === 'function') {
      const lance = Record.connectLance({ database: entry.path, vectorDim: body.vector_dim || DEFAULT_VECTOR_DIM });
      const results = await lance.search(body.vector, body);
      return { results, table: 'memory_vectors' };
    }
    const results = (entry.rows || []).slice(0, body.top_k || 6).map((row) => ({
      id: row.id, text: row.text || row.content, _distance: 0,
    }));
    return { results, table: 'memory_vectors' };
  }

  async _fallbackVectorDelete(projectId, dbName, body) {
    const key = this._fallbackKey(projectId, dbName);
    const entry = this._fallbackState.get(key);
    if (!entry || entry.type !== 'lancedb') throw new Error(`lancedb store '${dbName}' not found`);
    if (typeof Record.connectLance === 'function') {
      const lance = Record.connectLance({ database: entry.path });
      return lance.deleteVectors(body);
    }
    entry.rows = [];
    return { deleted: true };
  }
}

let _singleton = null;

function getMemoryDbClient() {
  if (!_singleton) _singleton = new MemoryDbClient();
  return _singleton;
}

module.exports = { MemoryDbClient, getMemoryDbClient, DEFAULT_VECTOR_DIM };
