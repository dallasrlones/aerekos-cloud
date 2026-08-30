'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { proxy } = require('../../../shared/conductorProxy');

function sidecarPath() {
  const base = process.env.DATABASE_PATH || path.join(__dirname, '../../data/vector_manager.db');
  return `${base}.vectors`;
}

function cosine(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function parseVec(v) {
  if (Array.isArray(v)) return v.map(Number);
  if (typeof v === 'string') {
    try { return JSON.parse(v).map(Number); } catch { return []; }
  }
  return [];
}

class VectorStore {
  constructor() {
    const file = sidecarPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT,
        project_id TEXT,
        idx TEXT,
        vector TEXT,
        metadata TEXT,
        PRIMARY KEY (project_id, idx, id)
      );
    `);
    this.upsertStmt = this.db.prepare(`
      INSERT INTO vectors (id, project_id, idx, vector, metadata)
      VALUES (@id, @project_id, @idx, @vector, @metadata)
      ON CONFLICT(project_id, idx, id) DO UPDATE SET vector = excluded.vector, metadata = excluded.metadata
    `);
  }

  conductorUrl() {
    return process.env.CONDUCTOR_URL || process.env.CONDUCTOR_INTERNAL_BASE_URL || '';
  }

  async tryRemoteUpsert(body) {
    const base = this.conductorUrl();
    if (!base) return null;
    const pid = body.project_id;
    const dbName = body.database || body.index || 'vectors';
    try {
      const res = await proxy('POST', `/api/services/db_manager/api/databases/${encodeURIComponent(dbName)}/vectors/upsert`, {
        projectId: pid,
        data: {
          project_id: pid,
          rows: body.rows || body.items || [{ id: body.id, vector: body.vector, metadata: body.metadata }],
        },
      });
      if (res.status >= 200 && res.status < 300) return { backend: 'db_manager', ...res.data };
    } catch { /* local fallback */ }
    return null;
  }

  async tryRemoteQuery(body) {
    const base = this.conductorUrl();
    if (!base) return null;
    const pid = body.project_id;
    const dbName = body.database || body.index || 'vectors';
    try {
      const res = await proxy('POST', `/api/services/db_manager/api/databases/${encodeURIComponent(dbName)}/vectors/search`, {
        projectId: pid,
        data: {
          project_id: pid,
          vector: body.vector,
          top_k: body.top_k || body.k || 10,
        },
      });
      if (res.status >= 200 && res.status < 300) return { backend: 'db_manager', ...res.data };
    } catch { /* local fallback */ }
    if (body.text || body.input) {
      try {
        const emb = await proxy('POST', '/api/services/ai_manager/api/v1/embeddings', {
          projectId: pid,
          data: { input: body.text || body.input, project_id: pid },
        });
        if (emb.status >= 200 && emb.status < 300) {
          const vector = emb.data?.embeddings?.[0] || emb.data?.data?.[0]?.embedding;
          if (vector) return this.queryLocal({ ...body, vector });
        }
      } catch { /* local fallback */ }
    }
    return null;
  }

  upsertLocal(body) {
    const pid = body.project_id;
    if (!pid) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
    const idx = String(body.index || 'default');
    const items = body.items || body.rows || (body.vector ? [{ id: body.id, vector: body.vector, metadata: body.metadata }] : []);
    if (!items.length) {
      const e = new Error('vector items required');
      e.status = 400;
      throw e;
    }
    const upserted = [];
    const tx = this.db.transaction((list) => {
      for (const it of list) {
        const id = String(it.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
        const vector = parseVec(it.vector || it.embedding);
        this.upsertStmt.run({
          id,
          project_id: String(pid),
          idx,
          vector: JSON.stringify(vector),
          metadata: JSON.stringify(it.metadata || {}),
        });
        upserted.push({ id, dim: vector.length });
      }
    });
    tx(items);
    return { upserted: upserted.length, items: upserted, backend: 'sqlite' };
  }

  queryLocal(body) {
    const pid = body.project_id;
    if (!pid) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
    const idx = String(body.index || 'default');
    const qv = parseVec(body.vector || body.embedding);
    if (!qv.length) {
      const e = new Error('vector required');
      e.status = 400;
      throw e;
    }
    const topK = Math.min(Number(body.top_k || body.k) || 10, 100);
    const rows = this.db.prepare(
      'SELECT id, vector, metadata FROM vectors WHERE project_id = ? AND idx = ?'
    ).all(String(pid), idx);
    const scored = rows.map((r) => ({
      id: r.id,
      score: cosine(qv, parseVec(r.vector)),
      metadata: (() => { try { return JSON.parse(r.metadata || '{}'); } catch { return {}; } })(),
    })).sort((a, b) => b.score - a.score).slice(0, topK);
    return { hits: scored, backend: 'sqlite' };
  }

  async upsert(body) {
    const remote = await this.tryRemoteUpsert(body);
    if (remote) return remote;
    return this.upsertLocal(body);
  }

  async query(body) {
    const remote = await this.tryRemoteQuery(body);
    if (remote) return remote;
    return this.queryLocal(body);
  }
}

module.exports = { VectorStore, cosine };
