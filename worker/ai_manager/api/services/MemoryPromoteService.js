const { randomUUID } = require('crypto');
const { MemoryStoreService } = require('./MemoryStoreService');
const { MemoryIngestService } = require('./MemoryIngestService');
const { getMemoryDbClient } = require('./MemoryDbClient');

class MemoryPromoteService {
  constructor(deps = {}) {
    this.db = deps.dbClient || getMemoryDbClient();
    this.storeService = deps.storeService || new MemoryStoreService(this.db);
    this.ingest = deps.ingestService || new MemoryIngestService({ dbClient: this.db, storeService: this.storeService });
  }

  async promote(projectId, { user_id: userId, session_id: sessionId } = {}) {
    const config = await this.storeService.getConfig(projectId);
    if (!config || config.status !== 'ready') {
      const e = new Error('memory stores not provisioned');
      e.status = 400;
      throw e;
    }

    const names = this.storeService.storeNames(config.store_name_prefix);
    const threshold = Number(config.importance_threshold) || 0.6;

    let sql = 'SELECT id, session_id, user_id, text, importance, source_message_ids FROM st_chunks WHERE importance >= ?';
    const params = [threshold];
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }

    const chunks = await this.db.memorySql(projectId, names.stMeta, { op: 'query', sql, params });
    const rows = chunks.rows || [];
    let promoted = 0;

    for (const row of rows) {
      const now = new Date().toISOString();
      const summaryId = randomUUID();
      const factId = randomUUID();

      await this.db.memorySql(projectId, names.ltMeta, {
        op: 'exec',
        sql: `INSERT INTO lt_summaries (id, user_id, session_id, text, created_at) VALUES (?, ?, ?, ?, ?)`,
        params: [summaryId, row.user_id, row.session_id || '', row.text, now],
      });

      await this.db.memorySql(projectId, names.ltMeta, {
        op: 'exec',
        sql: `INSERT INTO lt_facts (id, user_id, fact, source_chunk_id, created_at) VALUES (?, ?, ?, ?, ?)`,
        params: [factId, row.user_id, row.text.slice(0, 500), row.id, now],
      });

      const vector = await this.ingest._embed(projectId, config, row.text);
      await this.db.vectorUpsert(projectId, names.ltVectors, {
        rows: [{
          id: summaryId,
          vector,
          text: row.text,
          user_id: row.user_id,
          session_id: row.session_id || '',
          tier: 'long',
          metadata: { source_chunk_id: row.id, fact_id: factId },
        }],
        vector_dim: vector.length,
      });

      await this.db.memorySql(projectId, names.stMeta, {
        op: 'exec',
        sql: 'DELETE FROM st_chunks WHERE id = ?',
        params: [row.id],
      });
      await this.db.vectorDelete(projectId, names.stVectors, { ids: [row.id] });
      promoted += 1;
    }

    return { promoted, threshold, user_id: userId || null, session_id: sessionId || null };
  }

  async backfill(projectId, { user_id: userId, sessions = [] } = {}) {
    if (!userId || !Array.isArray(sessions) || !sessions.length) {
      const e = new Error('user_id and sessions[] are required');
      e.status = 400;
      throw e;
    }

    let ingested = 0;
    let duplicates = 0;
    for (const sess of sessions) {
      const sessionId = sess.session_id;
      const messages = sess.messages || [];
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        const result = await this.ingest.ingest(projectId, {
          user_id: userId,
          session_id: sessionId,
          message_id: m.message_id || m.id || `${sessionId}-${i}`,
          role: m.role,
          content: m.content,
          seq: m.seq ?? i + 1,
        });
        if (result.duplicate) duplicates += 1;
        else if (result.ingested) ingested += 1;
      }
    }
    return { ingested, duplicates, sessions: sessions.length };
  }
}

module.exports = { MemoryPromoteService };
