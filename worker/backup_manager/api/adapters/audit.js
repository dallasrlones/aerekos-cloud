'use strict';

const { json } = require('../utils/conductor');

function toJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
}

function parseJsonl(buf) {
  const text = buf.toString('utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function snapshot(ctx) {
  const { projectId, storage, prefix } = ctx;
  const data = await json('audit_manager', 'GET', '/api/v1/events', { projectId });
  const events = Array.isArray(data.items) ? data.items : Array.isArray(data.events) ? data.events : [];
  const body = toJsonl(events);
  const object = 'events.jsonl';
  await storage.putObject(projectId, storage.bucket, `${prefix}/${object}`, Buffer.from(body), 'application/x-ndjson');
  const manifest = {
    adapter: 'audit_manager',
    source: 'audit_manager',
    object,
    count: events.length,
  };
  const meta = await storage.putJson(projectId, storage.bucket, `${prefix}/snapshot.json`, manifest);
  return { size_bytes: Buffer.byteLength(body) + meta, extra: manifest };
}

async function restore(ctx, snapshotDoc) {
  const { projectId, storage, prefix } = ctx;
  const object = (snapshotDoc && snapshotDoc.object) || 'events.jsonl';
  const rows = parseJsonl(await storage.getObject(projectId, storage.bucket, `${prefix}/${object}`));
  const restored = [];
  for (const row of rows) {
    const body = {
      project_id: projectId,
      name: row.name || `evt-${Date.now().toString(36)}`,
      actor: row.actor || '',
      action: row.action || '',
      detail: row.detail || '{}',
    };
    const data = await json('audit_manager', 'POST', '/api/v1/events', { projectId, data: body });
    restored.push(data);
  }
  return { ok: true, restored: restored.length };
}

module.exports = { snapshot, restore };
