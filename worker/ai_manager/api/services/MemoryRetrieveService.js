const { MemoryStoreService } = require('./MemoryStoreService');
const { MemoryDbClient, DEFAULT_VECTOR_DIM } = require('./MemoryDbClient');
const { MemoryIngestService } = require('./MemoryIngestService');

const ST_TIMEOUT_MS = 200;
const LT_TIMEOUT_MS = 2000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

class MemoryRetrieveService {
  constructor(deps = {}) {
    this.db = deps.dbClient || new MemoryDbClient();
    this.storeService = deps.storeService || new MemoryStoreService(this.db);
    this.ingest = deps.ingestService || new MemoryIngestService({ dbClient: this.db, storeService: this.storeService });
  }

  async retrieve(projectId, opts = {}) {
    const {
      user_id: userId,
      session_id: sessionId,
      short_term: shortTerm = true,
      long_term: longTerm = false,
      query_text: queryText,
      top_k: topK = 6,
      token_budget: tokenBudget = 2000,
    } = opts;

    if (!userId) {
      const e = new Error('user_id is required for memory retrieve');
      e.status = 400;
      throw e;
    }

    const config = await this.storeService.getConfig(projectId, opts.store_name);
    if (!config || config.status !== 'ready') {
      return { context: '', items: [], short_term: [], long_term: [] };
    }

    const names = this.storeService.storeNames(config.store_name_prefix);
    const items = [];

    if (shortTerm && sessionId) {
      try {
        const recent = await withTimeout(
          this.db.memorySql(projectId, names.stMeta, {
            op: 'query',
            sql: 'SELECT role, content, seq FROM st_messages WHERE session_id = ? AND user_id = ? ORDER BY seq DESC LIMIT ?',
            params: [sessionId, userId, Math.min(topK, 12)],
          }),
          ST_TIMEOUT_MS
        );
        for (const row of (recent.rows || []).reverse()) {
          items.push({ tier: 'short', type: 'message', text: `${row.role}: ${row.content}` });
        }
      } catch {
        /* degrade */
      }

      if (queryText) {
        try {
          const vector = await this.ingest._embed(projectId, config, queryText);
          const hits = await withTimeout(
            this.db.vectorSearch(projectId, names.stVectors, {
              vector,
              top_k: topK,
              filter: { user_id: userId, session_id: sessionId },
              vector_dim: vector.length,
            }),
            ST_TIMEOUT_MS
          );
          for (const hit of hits.results || []) {
            items.push({ tier: 'short', type: 'vector', text: hit.text, id: hit.id, distance: hit._distance });
          }
        } catch {
          /* degrade */
        }
      }
    }

    let longTermItems = [];
    if (longTerm && queryText) {
      try {
        const vector = await this.ingest._embed(projectId, config, queryText);
        const hits = await withTimeout(
          this.db.vectorSearch(projectId, names.ltVectors, {
            vector,
            top_k: topK,
            filter: { user_id: userId },
            vector_dim: vector.length,
          }),
          LT_TIMEOUT_MS
        );
        longTermItems = (hits.results || []).map((hit) => ({
          tier: 'long',
          type: 'vector',
          text: hit.text,
          id: hit.id,
          distance: hit._distance,
        }));
        items.push(...longTermItems);
      } catch {
        /* degrade — short-term only */
      }
    }

    const context = this._formatContext(items, tokenBudget);
    return { context, items, short_term: items.filter((i) => i.tier === 'short'), long_term: longTermItems };
  }

  _formatContext(items, tokenBudget) {
    const lines = [];
    let used = 0;
    for (const item of items) {
      const line = item.text || '';
      const est = Math.ceil(line.length / 4);
      if (used + est > tokenBudget) break;
      lines.push(line);
      used += est;
    }
    if (!lines.length) return '';
    return `## Conversation memory\n${lines.map((l) => `- ${l}`).join('\n')}`;
  }

  buildSystemAppendix(retrieveResult) {
    if (!retrieveResult?.context) return null;
    return retrieveResult.context;
  }
}

module.exports = { MemoryRetrieveService };
