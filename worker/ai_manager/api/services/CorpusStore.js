'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_BUCKET = 'icarus-agent';

function corpusRoot() {
  return path.join(process.env.AI_MANAGER_DATA || path.join(__dirname, '../../data'), 'corpus');
}

function indexPath() {
  return path.join(corpusRoot(), '_index.jsonl');
}

function filePath(projectId, bucket, key) {
  const base = `/api/services/storage_manager/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files/${String(key).split('/').map(encodeURIComponent).join('/')}`;
  return base;
}

function normalizeToMarkdown(raw, contentType = '') {
  const t = String(raw || '');
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('json') || (/^\s*[{[]/.test(t) && !/<html/i.test(t))) {
    try {
      return `# JSON\n\n\`\`\`json\n${JSON.stringify(JSON.parse(t), null, 2)}\n\`\`\`\n`;
    } catch { /* plain */ }
  }
  if (/<[a-z][\s\S]*>/i.test(t)) {
    let s = t
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    return s.slice(0, 512000);
  }
  return t.trim().slice(0, 512000);
}

function rawExtension(contentType = '', raw = '') {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('html') || /<html/i.test(String(raw))) return 'html';
  return 'txt';
}

function contentHash(parts) {
  return crypto.createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
}

function datePrefix(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

class CorpusStore {
  constructor(deps = {}) {
    this.root = deps.root || corpusRoot();
    this.putRemote = deps.putRemote || null;
    this.appendIndex = deps.appendIndex !== false;
  }

  prefixFor(hash, d = new Date()) {
    return `icarus/corpus/${datePrefix(d)}/${hash}`;
  }

  async put({
    projectId,
    raw = '',
    normalized = '',
    meta = {},
    bucket = DEFAULT_BUCKET,
    hash: hashIn,
  } = {}) {
    if (!projectId) throw new Error('projectId required');
    const norm = normalized || normalizeToMarkdown(raw, meta.content_type);
    const hash = hashIn || contentHash([String(meta.url || meta.query || ''), norm.slice(0, 8000)]);
    const prefix = this.prefixFor(hash);
    const rawName = `raw.${rawExtension(meta.content_type, raw)}`;
    const metaDoc = {
      ...meta,
      hash,
      prefix,
      project_id: projectId,
      bucket,
      fetched_at: meta.fetched_at || new Date().toISOString(),
      bytes_raw: Buffer.byteLength(String(raw), 'utf8'),
      bytes_normalized: Buffer.byteLength(String(norm), 'utf8'),
    };
    const record = {
      project_id: projectId,
      hash,
      prefix,
      bucket,
      storage: 'local',
      paths: {},
    };

    const useRemote = Boolean(
      (this.putRemote || (process.env.CONDUCTOR_URL || process.env.CONDUCTOR_INTERNAL_BASE_URL))
      && process.env.CORPUS_LOCAL_ONLY !== '1',
    );

    if (useRemote) {
      try {
        const put = this.putRemote || this._putRemote.bind(this);
        await put(projectId, bucket, `${prefix}/${rawName}`, raw);
        await put(projectId, bucket, `${prefix}/normalized.md`, norm);
        await put(projectId, bucket, `${prefix}/meta.json`, JSON.stringify(metaDoc, null, 2));
        record.storage = 'storage_manager';
        record.paths = { raw: rawName, normalized: 'normalized.md', meta: 'meta.json' };
      } catch (e) {
        record.storage = 'local';
        record.fallback_reason = e.message || String(e);
      }
    }

    if (record.storage === 'local') {
      const dir = path.join(this.root, projectId, datePrefix(), hash);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, rawName), String(raw), 'utf8');
      fs.writeFileSync(path.join(dir, 'normalized.md'), String(norm), 'utf8');
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(metaDoc, null, 2), 'utf8');
      record.paths = {
        raw: path.join(dir, rawName),
        normalized: path.join(dir, 'normalized.md'),
        meta: path.join(dir, 'meta.json'),
      };
    }

    if (this.appendIndex) {
      this._appendIndex({
        project_id: projectId,
        hash,
        prefix,
        bucket,
        storage: record.storage,
        url: meta.url || '',
        query: meta.query || '',
        fetched_at: metaDoc.fetched_at,
      });
    }

    return { ok: true, hash, prefix, bucket, storage: record.storage, paths: record.paths, meta: metaDoc };
  }

  async _putRemote(projectId, bucket, key, content) {
    const { proxy } = require('../../../shared/conductorProxy');
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
    const res = await proxy('POST', filePath(projectId, bucket, key), {
      projectId,
      data: buf,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (res.status >= 400) {
      throw new Error(res.data?.error?.message || `storage_manager ${res.status}`);
    }
    return res.data;
  }

  _appendIndex(row) {
    try {
      fs.mkdirSync(path.dirname(indexPath()), { recursive: true });
      fs.appendFileSync(indexPath(), `${JSON.stringify(row)}\n`, 'utf8');
    } catch { /* index optional */ }
  }

  listRecent(projectId, { limit = 50 } = {}) {
    const out = [];
    const idx = indexPath();
    if (!fs.existsSync(idx)) return out;
    const lines = fs.readFileSync(idx, 'utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      try {
        const row = JSON.parse(lines[i]);
        if (row.project_id === projectId) out.push(row);
      } catch { /* skip */ }
    }
    return out;
  }

  readNormalized(projectId, hash, d = new Date()) {
    const local = path.join(this.root, projectId, datePrefix(d), hash, 'normalized.md');
    if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
    return '';
  }
}

const corpusStore = new CorpusStore();

module.exports = {
  CorpusStore,
  corpusStore,
  normalizeToMarkdown,
  contentHash,
  datePrefix,
  DEFAULT_BUCKET,
  corpusRoot,
};
