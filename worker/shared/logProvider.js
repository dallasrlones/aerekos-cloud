'use strict';

/**
 * Log ship/query seam (W6). Production: Loki-compatible or file → object storage.
 * SQLite append in logs_manager remains dev/offline profile.
 */

const fs = require('fs');
const path = require('path');

const KINDS = ['memory', 'file', 'loki'];

function resolveLogProviderKind(explicit) {
  const raw = explicit || process.env.AEREKOS_LOG_PROVIDER || 'memory';
  const k = String(raw).toLowerCase();
  return KINDS.includes(k) ? k : 'memory';
}

class MemoryLogProvider {
  constructor() {
    /** @type {Array<object>} */
    this.entries = [];
  }

  describe() {
    return {
      backend: 'memory',
      implemented: true,
      future: 'Loki push API or vector → object storage bundles',
    };
  }

  async append({ projectId, level, message, source = 'unknown', context = null }) {
    const row = {
      project_id: String(projectId || ''),
      level: String(level || 'info').toLowerCase(),
      message: String(message || ''),
      source: String(source || 'unknown'),
      context: context == null ? null : context,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(row);
    return { ok: true, id: this.entries.length };
  }

  async query({ projectId, limit = 100, since = null }) {
    let rows = this.entries;
    if (projectId) rows = rows.filter((r) => r.project_id === String(projectId));
    if (since) {
      const t = new Date(since).getTime();
      rows = rows.filter((r) => new Date(r.timestamp).getTime() >= t);
    }
    const n = Math.min(Math.max(1, Number(limit) || 100), 1000);
    return { items: rows.slice(-n) };
  }
}

class FileLogProvider {
  constructor(filePath) {
    this.filePath =
      filePath ||
      process.env.AEREKOS_LOG_PROVIDER_FILE ||
      path.join(process.cwd(), 'data', 'local-logs.ndjson');
  }

  describe() {
    return { backend: 'file', path: this.filePath, future: 'Loki / object log bundles' };
  }

  async append(row) {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      project_id: String(row.projectId || ''),
      level: String(row.level || 'info').toLowerCase(),
      message: String(row.message || ''),
      source: String(row.source || 'unknown'),
      context: row.context == null ? null : row.context,
      timestamp: new Date().toISOString(),
    });
    fs.appendFileSync(this.filePath, `${line}\n`, 'utf8');
    return { ok: true };
  }

  async query({ projectId, limit = 100 }) {
    if (!fs.existsSync(this.filePath)) return { items: [] };
    const lines = fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean);
    let items = lines.map((l) => JSON.parse(l));
    if (projectId) items = items.filter((r) => r.project_id === String(projectId));
    const n = Math.min(Math.max(1, Number(limit) || 100), 1000);
    return { items: items.slice(-n) };
  }
}

function createLogProvider(kind) {
  const resolved = resolveLogProviderKind(kind);
  if (resolved === 'memory') return new MemoryLogProvider();
  if (resolved === 'file') return new FileLogProvider();
  const e = new Error(`log provider "${resolved}" is not implemented`);
  e.code = 'LogProviderNotImplemented';
  e.status = 501;
  throw e;
}

module.exports = {
  KINDS,
  MemoryLogProvider,
  FileLogProvider,
  resolveLogProviderKind,
  createLogProvider,
};
