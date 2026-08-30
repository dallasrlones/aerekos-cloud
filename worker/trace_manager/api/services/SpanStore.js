'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function sidecarPath() {
  const base = process.env.DATABASE_PATH || path.join(__dirname, '../../data/trace_manager.db');
  return `${base}.spans`;
}

function hex(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v);
}

function attrsToObj(list) {
  const out = {};
  for (const a of list || []) {
    const key = a.key || a.name;
    if (!key) continue;
    const val = a.value || {};
    out[key] = val.stringValue ?? val.intValue ?? val.doubleValue ?? val.boolValue ?? val;
  }
  return out;
}

class SpanStore {
  constructor() {
    const file = sidecarPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS spans (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        trace_id TEXT,
        span_id TEXT,
        parent_span_id TEXT,
        name TEXT,
        start_time TEXT,
        end_time TEXT,
        attributes TEXT,
        resource TEXT
      );
      CREATE INDEX IF NOT EXISTS spans_trace ON spans (project_id, trace_id);
      CREATE INDEX IF NOT EXISTS spans_name ON spans (project_id, name);
    `);
    this.insert = this.db.prepare(`
      INSERT INTO spans (id, project_id, trace_id, span_id, parent_span_id, name, start_time, end_time, attributes, resource)
      VALUES (@id, @project_id, @trace_id, @span_id, @parent_span_id, @name, @start_time, @end_time, @attributes, @resource)
    `);
  }

  ingest(body, projectId) {
    const pid = String(projectId || body?.project_id || 'default');
    const resourceSpans = body?.resourceSpans || body?.resource_spans || [];
    const rows = [];
    for (const rs of resourceSpans) {
      const resource = attrsToObj(rs.resource?.attributes);
      for (const ss of rs.scopeSpans || rs.scope_spans || []) {
        for (const span of ss.spans || []) {
          const row = {
            id: crypto.randomUUID(),
            project_id: pid,
            trace_id: hex(span.traceId || span.trace_id),
            span_id: hex(span.spanId || span.span_id),
            parent_span_id: hex(span.parentSpanId || span.parent_span_id),
            name: String(span.name || 'span'),
            start_time: String(span.startTimeUnixNano || span.start_time_unix_nano || ''),
            end_time: String(span.endTimeUnixNano || span.end_time_unix_nano || ''),
            attributes: JSON.stringify(attrsToObj(span.attributes)),
            resource: JSON.stringify(resource),
          };
          this.insert.run(row);
          rows.push(row);
        }
      }
    }
    return { accepted: rows.length, spans: rows };
  }

  list({ project_id, trace_id, name, limit } = {}) {
    if (!project_id) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
    const max = Math.min(Number(limit) || 100, 1000);
    let sql = 'SELECT * FROM spans WHERE project_id = ?';
    const args = [String(project_id)];
    if (trace_id) {
      sql += ' AND trace_id = ?';
      args.push(String(trace_id));
    }
    if (name) {
      sql += ' AND name = ?';
      args.push(String(name));
    }
    sql += ' ORDER BY start_time LIMIT ?';
    args.push(max);
    return this.db.prepare(sql).all(...args).map((r) => ({
      ...r,
      attributes: (() => { try { return JSON.parse(r.attributes || '{}'); } catch { return {}; } })(),
      resource: (() => { try { return JSON.parse(r.resource || '{}'); } catch { return {}; } })(),
    }));
  }
}

module.exports = { SpanStore };
