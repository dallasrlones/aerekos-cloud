const { randomUUID } = require('crypto');
const { MemoryStoreService } = require('./MemoryStoreService');
const { MemoryDbClient, DEFAULT_VECTOR_DIM } = require('./MemoryDbClient');
const { ProviderResolver } = require('./ProviderResolver');
const { EmbeddingService } = require('./EmbeddingService');
const { MemoryExtractService } = require('./MemoryExtractService');

class MemoryIngestService {
  constructor(deps = {}) {
    this.db = deps.dbClient || new MemoryDbClient();
    this.storeService = deps.storeService || new MemoryStoreService(this.db);
    this.resolver = deps.resolver || new ProviderResolver();
    this.extractor = deps.extractor || new MemoryExtractService({ resolver: this.resolver });
  }

  async ingest(projectId, body) {
    const {
      user_id: userId,
      session_id: sessionId,
      message_id: messageId,
      role,
      content,
      seq,
    } = body || {};

    if (!userId || !sessionId || !messageId || !role || !content) {
      const e = new Error('user_id, session_id, message_id, role, and content are required');
      e.status = 400;
      throw e;
    }

    const config = await this.storeService.getConfig(projectId, body.store_name);
    if (!config || config.status !== 'ready') {
      const e = new Error('memory stores not provisioned');
      e.status = 400;
      e.code = 'memory_not_ready';
      throw e;
    }

    const names = this.storeService.storeNames(config.store_name_prefix);
    const windowSize = Number(config.window_size) || 200;

    const dup = await this.db.memorySql(projectId, names.stMeta, {
      op: 'query',
      sql: 'SELECT id FROM st_messages WHERE message_id = ?',
      params: [messageId],
    });
    if (dup.rows?.length) {
      return { ingested: false, duplicate: true, message_id: messageId };
    }

    const msgId = randomUUID();
    const now = new Date().toISOString();
    const seqNum = Number(seq) || Date.now();

    await this.db.memorySql(projectId, names.stMeta, {
      op: 'exec',
      sql: `INSERT INTO st_messages (id, message_id, session_id, user_id, role, content, seq, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [msgId, messageId, sessionId, userId, role, content, seqNum, now],
    });

    const countRes = await this.db.memorySql(projectId, names.stMeta, {
      op: 'query',
      sql: 'SELECT COUNT(*) as cnt FROM st_messages WHERE session_id = ?',
      params: [sessionId],
    });
    const count = countRes.rows?.[0]?.cnt || 0;
    if (count > windowSize) {
      const trim = count - windowSize;
      await this.db.memorySql(projectId, names.stMeta, {
        op: 'exec',
        sql: `DELETE FROM st_messages WHERE id IN (
          SELECT id FROM st_messages WHERE session_id = ? ORDER BY seq ASC LIMIT ?
        )`,
        params: [sessionId, trim],
      });
    }

    const extraction = await this.extractor.extract(projectId, config, { role, content });
    const importance = Number(extraction.importance) || 0.45;
    const threshold = Number(config.importance_threshold) || 0.6;
    let embedded = false;

    const embedTexts = (extraction.items || [])
      .filter((i) => Number(i.importance) >= threshold || importance >= threshold)
      .map((i) => String(i.text || '').trim())
      .filter(Boolean);
    if (!embedTexts.length && importance >= threshold) embedTexts.push(content);

    for (const chunkText of embedTexts.slice(0, 3)) {
      const vector = await this._embed(projectId, config, chunkText);
      const chunkId = randomUUID();
      await this.db.memorySql(projectId, names.stMeta, {
        op: 'exec',
        sql: `INSERT INTO st_chunks (id, session_id, user_id, text, importance, source_message_ids, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [chunkId, sessionId, userId, chunkText, importance, JSON.stringify([messageId]), now],
      });
      await this.db.vectorUpsert(projectId, names.stVectors, {
        rows: [{
          id: chunkId,
          vector,
          text: chunkText,
          user_id: userId,
          session_id: sessionId,
          tier: 'short',
          metadata: { message_id: messageId, importance, narrative: extraction.narrative || '' },
        }],
        vector_dim: vector.length,
      });
      embedded = true;
    }

    return {
      ingested: true,
      message_id: messageId,
      importance,
      embedded,
      session_id: sessionId,
    };
  }

  async _embed(projectId, config, text) {
    if (config.embeddings_integration) {
      try {
        const fakeReq = {
          query: { project_id: projectId, integration: config.embeddings_integration },
          body: { input: text },
        };
        const cfg = await this.resolver.resolve(fakeReq, 'embeddings');
        const env = { ...process.env, OLLAMA_HOST: cfg.endpoint, OLLAMA_MODE: 'external' };
        if (cfg.model) env.EMBEDDING_MODEL = cfg.model;
        const svc = new EmbeddingService(env);
        const result = await svc.embed({ input: text });
        const embedding = result?.embeddings?.[0] || result?.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length) return embedding;
      } catch {
        /* fall through to hash embedding */
      }
    }
    return this._hashEmbed(text, DEFAULT_VECTOR_DIM);
  }

  _hashEmbed(text, dim) {
    const out = new Array(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      out[i % dim] += text.charCodeAt(i) / 255;
    }
    const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
    return out.map((v) => v / norm);
  }
}

module.exports = { MemoryIngestService };
