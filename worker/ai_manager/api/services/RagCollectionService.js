'use strict';

const { randomUUID } = require('crypto');
const { RagCollection, RagDocument, IntelligenceAttachment } = require('../models');
const { MemoryIngestService } = require('./MemoryIngestService');
const { buildEndpointArn, enrichEndpoint } = require('./EndpointArn');
const { isValidName } = require('../../../shared/arn');

function truthy(v) {
  return v === true || v === 'true' || v === '1' || v === 1;
}

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1);
}

function parseVector(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function chunkText(text, max = 1800) {
  const src = String(text || '').trim();
  if (src.length <= max) return src ? [src] : [];
  const parts = src.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  let buf = '';
  for (const p of parts.length ? parts : [src]) {
    if ((buf + '\n\n' + p).length > max && buf) {
      out.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) out.push(buf);
  return out;
}

class RagCollectionService {
  constructor(deps = {}) {
    this.M = RagCollection;
    this.D = RagDocument;
    this.A = IntelligenceAttachment;
    this.embedder = deps.ingestService || new MemoryIngestService();
  }

  assertP(p) {
    if (!p || !String(p).trim()) throw fail(400, 'project_id required');
  }

  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name || '').trim();
    if (!isValidName(name)) throw fail(400, 'name must be lowercase alphanumeric with hyphens');
    const dup = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (dup.length) throw fail(409, 'name taken');
    const row = await this.M.create({
      project_id: body.project_id,
      name,
      description: String(body.description || ''),
      embeddings_integration: String(body.embeddings_integration || ''),
      enabled: truthy(body.enabled === undefined ? true : body.enabled) ? 'true' : 'false',
      options: typeof body.options === 'object' ? JSON.stringify(body.options) : String(body.options || ''),
      arn: buildEndpointArn(body.project_id, 'rag', name),
    });
    const saved = Array.isArray(row) ? row[0] : row;
    return this.enrich(saved, body.project_id);
  }

  async list(projectId) {
    this.assertP(projectId);
    const rows = await this.M.findAll({ where: { project_id: projectId } });
    return Promise.all(rows.map((row) => this.enrich(row, projectId)));
  }

  async get(id, projectId) {
    this.assertP(projectId);
    const r = await this.M.findAll({ where: { id, project_id: projectId } });
    if (!r.length) throw fail(404, 'Not found');
    return this.enrich(r[0], projectId);
  }

  async getByName(projectId, name) {
    this.assertP(projectId);
    const r = await this.M.findAll({ where: { project_id: projectId, name: String(name).trim() } });
    if (!r.length) throw fail(404, `RAG collection "${name}" not found`);
    return this.enrich(r[0], projectId);
  }

  async update(id, projectId, body) {
    await this.get(id, projectId);
    const patch = {};
    if (body.description !== undefined) patch.description = String(body.description || '');
    if (body.embeddings_integration !== undefined) patch.embeddings_integration = String(body.embeddings_integration || '');
    if (body.enabled !== undefined) patch.enabled = truthy(body.enabled) ? 'true' : 'false';
    if (body.options !== undefined) {
      patch.options = typeof body.options === 'object' ? JSON.stringify(body.options) : String(body.options || '');
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!isValidName(name)) throw fail(400, 'name must be lowercase alphanumeric with hyphens');
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) throw fail(409, 'name taken');
      const cur = await this.get(id, projectId);
      patch.name = name;
      patch.arn = buildEndpointArn(projectId, 'rag', name);
      if (name !== cur.name) {
        const docs = await this.D.findAll({ where: { project_id: projectId, collection_name: cur.name } });
        for (const d of docs) await this.D.update(d.id, { collection_name: name });
        const atts = await this.A.findAll({ where: { project_id: projectId, kind: 'rag', target_name: cur.name } });
        for (const a of atts) await this.A.update(a.id, { target_name: name });
      }
    }
    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectId);
  }

  async del(id, projectId) {
    const cur = await this.get(id, projectId);
    const docs = await this.D.findAll({ where: { project_id: projectId, collection_name: cur.name } });
    for (const d of docs) await this.D.delete(d.id);
    const atts = await this.A.findAll({ where: { project_id: projectId, kind: 'rag', target_name: cur.name } });
    for (const a of atts) await this.A.delete(a.id);
    await this.M.delete(id);
    return { deleted: true, id };
  }

  async ingest(id, projectId, body) {
    const col = await this.get(id, projectId);
    const title = String(body.title || body.name || 'document').trim();
    const text = String(body.text || body.content || '').trim();
    if (!text) throw fail(400, 'text is required');
    const chunks = chunkText(text);
    const created = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await this.embedder._embed(projectId, {
        embeddings_integration: col.embeddings_integration,
      }, chunk);
      const docId = String(body.doc_id || body.id || randomUUID()) + (chunks.length > 1 ? `-${i}` : '');
      const row = await this.D.create({
        project_id: projectId,
        collection_name: col.name,
        doc_id: docId,
        title: chunks.length > 1 ? `${title} (${i + 1})` : title,
        text: chunk,
        vector: JSON.stringify(vector),
        metadata: JSON.stringify(body.metadata || {}),
      });
      created.push(Array.isArray(row) ? row[0] : row);
    }
    return { ingested: created.length, documents: created.map((d) => ({ id: d.id, doc_id: d.doc_id, title: d.title })) };
  }

  async search(projectId, collectionName, { query, top_k: topK = 6 } = {}) {
    const col = await this.getByName(projectId, collectionName);
    const q = String(query || '').trim();
    if (!q) throw fail(400, 'query is required');
    const qv = await this.embedder._embed(projectId, {
      embeddings_integration: col.embeddings_integration,
    }, q);
    const docs = await this.D.findAll({ where: { project_id: projectId, collection_name: col.name } });
    const scored = docs.map((d) => ({
      id: d.id,
      doc_id: d.doc_id,
      title: d.title,
      text: d.text,
      score: cosine(qv, parseVector(d.vector)),
    })).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Number(topK) || 6));
    return { collection: col.name, items: scored };
  }

  async listDocuments(id, projectId) {
    const col = await this.get(id, projectId);
    const docs = await this.D.findAll({ where: { project_id: projectId, collection_name: col.name } });
    return docs.map((d) => ({ id: d.id, doc_id: d.doc_id, title: d.title, text: d.text, created_at: d.created_at }));
  }

  async deleteDocument(id, projectId, docRowId) {
    await this.get(id, projectId);
    const rows = await this.D.findAll({ where: { id: docRowId, project_id: projectId } });
    if (!rows.length) throw fail(404, 'document not found');
    await this.D.delete(docRowId);
    return { deleted: true, id: docRowId };
  }

  async enrich(row, projectId) {
    const docs = await this.D.findAll({ where: { project_id: projectId, collection_name: row.name } });
    const atts = await this.A.findAll({ where: { project_id: projectId, kind: 'rag', target_name: row.name } });
    return {
      ...enrichEndpoint({ ...row, capability: 'rag', project_id: projectId }),
      embeddings_integration: row.embeddings_integration || '',
      document_count: docs.length,
      attached_to: atts.map((a) => a.intelligence_name),
    };
  }
}

module.exports = { RagCollectionService };
