const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const MAX_ATTEMPTS = 25;
const MAX_MESSAGE = 32768;
const MAX_CONTEXT = 65536;

/**
 * Durable on-disk buffer for log lines before they are shipped to conductor → logs_manager.
 * Uses SQLite (single writer). Safe to call enqueue while offline; shipper flushes when online.
 */
class LogOutbox {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  open() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS log_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'unknown',
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context_json TEXT,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_log_outbox_pending ON log_outbox(id);
    `);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * @param {{ projectId: string, level: string, message: string, source?: string, context?: object }} row
   */
  enqueue({ projectId, level, message, source = 'unknown', context = null }) {
    if (!this.db) {
      this.open();
    }
    const msg =
      String(message).length > MAX_MESSAGE ? String(message).slice(0, MAX_MESSAGE) : String(message);
    let ctx = '';
    if (context != null) {
      try {
        const j = typeof context === 'string' ? context : JSON.stringify(context);
        ctx = j.length > MAX_CONTEXT ? j.slice(0, MAX_CONTEXT) : j;
      } catch {
        ctx = '';
      }
    }
    const stmt = this.db.prepare(
      `INSERT INTO log_outbox (project_id, source, level, message, context_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      String(projectId).slice(0, 256),
      String(source).slice(0, 256),
      String(level).toLowerCase().slice(0, 32),
      msg,
      ctx,
      new Date().toISOString()
    );
  }

  takeBatch(limit) {
    if (!this.db) {
      this.open();
    }
    const n = Math.min(Math.max(1, parseInt(limit, 10) || 1), 200);
    const rows = this.db
      .prepare(
        `SELECT id, project_id, source, level, message, context_json
         FROM log_outbox ORDER BY id ASC LIMIT ?`
      )
      .all(n);
    return rows;
  }

  removeIds(ids) {
    if (!this.db || !ids.length) {
      return;
    }
    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(`DELETE FROM log_outbox WHERE id IN (${placeholders})`).run(...ids);
  }

  /**
   * @param {string} errMsg
   */
  bumpFailure(id, errMsg) {
    if (!this.db) {
      return;
    }
    const cur = this.db.prepare(`SELECT attempts FROM log_outbox WHERE id = ?`).get(id);
    if (!cur) {
      return;
    }
    const next = (cur.attempts || 0) + 1;
    const e = (errMsg || 'unknown').slice(0, 2000);
    if (next >= MAX_ATTEMPTS) {
      console.error(`[logOutbox] dropped id=${id} after ${MAX_ATTEMPTS} attempts: ${e}`);
      this.db.prepare(`DELETE FROM log_outbox WHERE id = ?`).run(id);
    } else {
      this.db
        .prepare(
          `UPDATE log_outbox SET attempts = ?, last_error = ? WHERE id = ?`
        )
        .run(next, e, id);
    }
  }

  /**
   * For metrics / health.
   */
  pendingCount() {
    if (!this.db) {
      this.open();
    }
    const r = this.db.prepare(`SELECT COUNT(1) AS c FROM log_outbox`).get();
    return r ? r.c : 0;
  }
}

module.exports = { LogOutbox, MAX_ATTEMPTS };
