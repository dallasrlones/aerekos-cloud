'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function sidecarPath() {
  const base = process.env.DATABASE_PATH || path.join(__dirname, '../../data/search_manager.db');
  return `${base}.fts`;
}

function open() {
  const file = sidecarPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
      project_id UNINDEXED,
      idx UNINDEXED,
      title,
      body,
      doc_id UNINDEXED
    );
  `);
  return db;
}

function quoteToken(t) {
  return `"${String(t).replace(/"/g, '""')}"`;
}

function ftsMatch(q) {
  const cleaned = String(q || '').replace(/[']/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.split(/\s+/).filter(Boolean).map(quoteToken).join(' ');
}

class FtsStore {
  constructor() {
    this.db = open();
    this.insert = this.db.prepare(
      'INSERT INTO docs (project_id, idx, title, body, doc_id) VALUES (?, ?, ?, ?, ?)'
    );
    this.count = this.db.prepare(
      'SELECT count(*) AS n FROM docs WHERE project_id = ? AND idx = ?'
    );
    this.all = this.db.prepare(
      'SELECT title, body, idx AS "index", doc_id AS id FROM docs WHERE project_id = ? AND idx = ?'
    );
  }

  indexDocs({ project_id, index: idx, title, body, docs, text } = {}) {
    if (!project_id) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
    const indexName = String(idx || 'docs').trim() || 'docs';
    const rows = [];
    if (Array.isArray(docs)) {
      for (const d of docs) {
        rows.push({
          title: String(d.title || d.name || ''),
          body: String(d.body || d.text || d.content || ''),
        });
      }
    } else if (title || body || text) {
      rows.push({ title: String(title || ''), body: String(body || text || '') });
    }
    if (!rows.length) {
      const e = new Error('title/body or docs required');
      e.status = 400;
      throw e;
    }
    const added = [];
    const tx = this.db.transaction((list) => {
      for (const row of list) {
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        this.insert.run(String(project_id), indexName, row.title, row.body, id);
        added.push({ id, index: indexName, title: row.title, body: row.body });
      }
    });
    tx(rows);
    return { indexed: added.length, docs: added, index: indexName };
  }

  query({ project_id, index: idx, q, query } = {}) {
    if (!project_id) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
    const indexName = String(idx || 'docs').trim() || 'docs';
    const n = this.count.get(String(project_id), indexName).n;
    if (!n) return { hits: [], index: indexName, empty: true };

    const match = ftsMatch(q || query);
    let rows;
    if (match) {
      rows = this.db.prepare(
        `SELECT title, body, idx AS "index", doc_id AS id, bm25(docs) AS score
         FROM docs
         WHERE docs MATCH ? AND project_id = ? AND idx = ?
         ORDER BY score`
      ).all(match, String(project_id), indexName);
    } else {
      rows = this.all.all(String(project_id), indexName);
    }
    return {
      hits: rows.map((r) => ({
        id: r.id,
        index: r.index,
        title: r.title,
        body: r.body,
        score: r.score == null ? undefined : r.score,
      })),
      index: indexName,
    };
  }
}

module.exports = { FtsStore };
