const Record = require('aerekos-record');
const logger = require('../utils/logger');

const ALLOWED_TABLES = new Set([
  'memory_sessions',
  'st_messages',
  'st_chunks',
  'lt_summaries',
  'lt_facts'
]);

const BLOCKED_KEYWORDS = /\b(DROP|ALTER|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i;

class MemorySqlService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this._connections = new Map();
  }

  async resolveSqliteConnection(name, projectId) {
    const cacheKey = `${projectId}:${name}`;
    if (this._connections.has(cacheKey)) {
      return this._connections.get(cacheKey);
    }

    const dbInstance = await this.databaseService.getDatabase(name, projectId);
    if (dbInstance.type !== 'sqlite3') {
      throw new Error(`Database '${name}' is not a sqlite3 instance`);
    }
    const metadata = JSON.parse(dbInstance.metadata || '{}');
    const databasePath = metadata.database;
    if (!databasePath) {
      throw new Error(`SQLite path missing for '${name}'`);
    }

    const db = Record.connect('sqlite', {
      database: databasePath,
      readonly: false,
      fileMustExist: false,
      timeout: 5000
    });
    const models = Record.registerMemoryModels(db);
    const conn = { dbInstance, databasePath, db, models };
    this._connections.set(cacheKey, conn);
    return conn;
  }

  validateSql(sql, op) {
    if (!sql || typeof sql !== 'string') {
      throw new Error('sql is required');
    }
    const trimmed = sql.trim();
    if (BLOCKED_KEYWORDS.test(trimmed)) {
      throw new Error('SQL contains blocked keywords');
    }
    if (trimmed.includes(';')) {
      throw new Error('Multiple SQL statements are not allowed');
    }

    const tableRefs = [...trimmed.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)]
      .map((m) => m[1].toLowerCase());

    for (const table of tableRefs) {
      if (!ALLOWED_TABLES.has(table)) {
        throw new Error(`Table '${table}' is not allowed for memory SQL`);
      }
    }

    if (op === 'query' && !/^\s*SELECT\b/i.test(trimmed)) {
      throw new Error('query op requires a SELECT statement');
    }
    if (op === 'exec' && !/^\s*(INSERT|UPDATE|DELETE)\b/i.test(trimmed)) {
      throw new Error('exec op requires INSERT, UPDATE, or DELETE');
    }

    return trimmed;
  }

  async run(name, projectId, { op, sql, params = [] } = {}) {
    if (!['query', 'exec'].includes(op)) {
      throw new Error('op must be query or exec');
    }

    const validatedSql = this.validateSql(sql, op);
    const { db } = await this.resolveSqliteConnection(name, projectId);

    if (op === 'query') {
      const stmt = db.db.prepare(validatedSql);
      const rows = Array.isArray(params) && params.length > 0
        ? stmt.all(...params)
        : stmt.all();
      return { rows, rowCount: rows.length };
    }

    const stmt = db.db.prepare(validatedSql);
    const result = Array.isArray(params) && params.length > 0
      ? stmt.run(...params)
      : stmt.run();
    logger.info(`[MemorySqlService] exec on ${name}: changes=${result.changes}`);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }

  async ensureSchema(name, projectId) {
    await this.resolveSqliteConnection(name, projectId);
    return { schema: 'memory_v1' };
  }
}

module.exports = MemorySqlService;
