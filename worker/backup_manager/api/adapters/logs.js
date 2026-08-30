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
  const data = await json('logs_manager', 'GET', '/api/v1/logs?limit=1000', { projectId });
  const logs = Array.isArray(data.logs) ? data.logs : Array.isArray(data.items) ? data.items : [];
  const body = toJsonl(logs);
  const object = 'events.jsonl';
  await storage.putObject(projectId, storage.bucket, `${prefix}/${object}`, Buffer.from(body), 'application/x-ndjson');
  const manifest = {
    adapter: 'logs_manager',
    source: 'logs_manager',
    object,
    count: logs.length,
  };
  const meta = await storage.putJson(projectId, storage.bucket, `${prefix}/snapshot.json`, manifest);
  return { size_bytes: Buffer.byteLength(body) + meta, extra: manifest };
}

async function restore(ctx, snapshotDoc) {
  const { projectId, storage, prefix } = ctx;
  const object = (snapshotDoc && snapshotDoc.object) || 'events.jsonl';
  const rows = parseJsonl(await storage.getObject(projectId, storage.bucket, `${prefix}/${object}`));
  const entries = rows.map((row) => ({
    level: row.level || 'info',
    message: row.message || '',
    source: row.source || 'backup_restore',
    context: row.context || { restored: true },
  })).filter((e) => e.message);
  const posted = [];
  const BATCH = 200;
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH);
    if (!chunk.length) continue;
    const data = await json('logs_manager', 'POST', '/api/v1/logs/batch', {
      projectId,
      data: { project_id: projectId, entries: chunk },
    });
    posted.push(data);
  }
  return { ok: true, restored: entries.length, batches: posted.length };
}

module.exports = { snapshot, restore };
