const { LogEvent } = require('../models');

const LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const MAX_MESSAGE = 32768;
const MAX_CONTEXT_JSON = 65536;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const MAX_BATCH = 200;

class LogEventService {
  constructor(deps = {}) {
    this.LogEvent = deps.LogEvent || LogEvent;
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  assertLevel(level) {
    const v = String(level || '')
      .trim()
      .toLowerCase();
    if (!LEVELS.has(v)) {
      const e = new Error('level must be one of: debug, info, warn, error, fatal');
      e.status = 400;
      throw e;
    }
    return v;
  }

  normalizeMessage(msg) {
    const s = msg == null ? '' : String(msg);
    if (s.length > MAX_MESSAGE) {
      return s.slice(0, MAX_MESSAGE);
    }
    return s;
  }

  normalizeContext(ctx) {
    if (ctx == null || ctx === '') return '';
    if (typeof ctx === 'string') {
      if (ctx.length > MAX_CONTEXT_JSON) {
        return ctx.slice(0, MAX_CONTEXT_JSON);
      }
      try {
        JSON.parse(ctx);
        return ctx;
      } catch {
        return JSON.stringify({ _raw: ctx.slice(0, MAX_CONTEXT_JSON) });
      }
    }
    try {
      const j = JSON.stringify(ctx);
      return j.length > MAX_CONTEXT_JSON ? j.slice(0, MAX_CONTEXT_JSON) : j;
    } catch {
      return '';
    }
  }

  async create(body) {
    this.assertProjectId(body.project_id);
    const level = this.assertLevel(body.level);
    const message = this.normalizeMessage(body.message);
    if (!message) {
      const e = new Error('message is required');
      e.status = 400;
      throw e;
    }
    const source = body.source != null ? String(body.source).slice(0, 256) : 'unknown';
    return this.LogEvent.create({
      project_id: body.project_id,
      source,
      level,
      message,
      context: this.normalizeContext(body.context)
    });
  }

  /**
   * Create many log events in one request (used by worker outbox shipper, sync after offline).
   * All rows share the same project_id. Each entry: { level, message, source?, context? }.
   */
  async createBatch(body) {
    this.assertProjectId(body.project_id);
    const entries = body.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      const e = new Error('entries must be a non-empty array');
      e.status = 400;
      throw e;
    }
    if (entries.length > MAX_BATCH) {
      const e = new Error(`entries may contain at most ${MAX_BATCH} items`);
      e.status = 400;
      throw e;
    }
    const out = [];
    for (const ent of entries) {
      if (!ent || typeof ent !== 'object') {
        const e = new Error('each entry must be an object');
        e.status = 400;
        throw e;
      }
      const level = this.assertLevel(ent.level);
      const message = this.normalizeMessage(ent.message);
      if (!message) {
        const e = new Error('each entry requires a non-empty message');
        e.status = 400;
        throw e;
      }
      const source = ent.source != null ? String(ent.source).slice(0, 256) : 'unknown';
      // eslint-disable-next-line no-await-in-loop
      const row = await this.LogEvent.create({
        project_id: body.project_id,
        source,
        level,
        message,
        context: this.normalizeContext(ent.context)
      });
      out.push(row);
    }
    return out;
  }

  parseTime(value, field) {
    if (!value) return null;
    const t = new Date(value);
    if (Number.isNaN(t.getTime())) {
      const e = new Error(`${field} must be a valid ISO-8601 date`);
      e.status = 400;
      throw e;
    }
    return t.toISOString();
  }

  /**
   * List recent logs for a project (newest first).
   * Filters: level, source (exact), q (message contains), since, until, limit.
   */
  async list(projectId, { level, since, until, source, q, limit } = {}) {
    this.assertProjectId(projectId);
    const where = { project_id: projectId };
    if (level) {
      where.level = this.assertLevel(level);
    }
    if (source != null && String(source).trim()) {
      where.source = String(source).trim();
    }
    const sinceIso = this.parseTime(since, 'since');
    const untilIso = this.parseTime(until, 'until');
    if (sinceIso) {
      where.created_at = { ...(where.created_at || {}), gte: sinceIso };
    }
    if (untilIso) {
      where.created_at = { ...(where.created_at || {}), lte: untilIso };
    }
    let lim = parseInt(limit, 10);
    if (Number.isNaN(lim) || lim < 1) {
      lim = DEFAULT_LIMIT;
    }
    lim = Math.min(lim, MAX_LIMIT);
    const needle = q != null && String(q).trim() ? String(q).trim().toLowerCase() : '';
    const rows = await this.LogEvent.findAll({
      where,
      order: 'created_at DESC',
      limit: needle ? MAX_LIMIT : lim
    });
    if (!needle) return rows;
    return rows.filter((r) => String(r.message || '').toLowerCase().includes(needle)).slice(0, lim);
  }

  async getById(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.LogEvent.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Log not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async compact(projectId, { olderThanDays } = {}) {
    this.assertProjectId(projectId);
    const days = Number(olderThanDays || process.env.LOG_RETENTION_DAYS || 14);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const rows = await this.LogEvent.findAll({ where: { project_id: projectId } });
    let deleted = 0;
    for (const row of rows) {
      if (String(row.created_at || '') < cutoff) {
        await this.LogEvent.delete(row.id);
        deleted += 1;
      }
    }
    return { compacted: deleted, older_than: cutoff };
  }

  async deleteById(id, projectId) {
    await this.getById(id, projectId);
    await this.LogEvent.delete(id);
    return { deleted: true, id };
  }
}

module.exports = { LogEventService, LEVELS, MAX_MESSAGE };
