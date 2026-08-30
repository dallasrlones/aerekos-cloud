'use strict';

const { call, json } = require('../utils/conductor');

function secretRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.value != null) {
    const e = new Error('refusing to persist plaintext secret values');
    e.status = 500;
    throw e;
  }
  if (!row.ciphertext) return null;
  return {
    name: row.name,
    ciphertext: row.ciphertext,
    key_name: row.key_name || '',
    key_version: row.key_version == null ? '' : row.key_version,
    metadata: row.metadata || null,
  };
}

async function listWithCiphertext(projectId) {
  const listed = await json('secrets_manager', 'GET', '/api/v1/secrets?include_ciphertext=1', { projectId });
  const rows = Array.isArray(listed.secrets) ? listed.secrets : Array.isArray(listed.items) ? listed.items : [];
  if (rows.some((r) => r && r.ciphertext)) {
    return rows.map(secretRow).filter(Boolean);
  }
  const out = [];
  for (const row of rows) {
    if (!row || !row.id) continue;
    const one = await json('secrets_manager', 'GET', `/api/v1/secrets/${encodeURIComponent(row.id)}`, { projectId });
    const packed = secretRow((one && one.secret) || one);
    if (packed) out.push(packed);
  }
  return out;
}

async function snapshot(ctx) {
  const { projectId, storage, prefix } = ctx;
  const secrets = await listWithCiphertext(projectId);
  const manifest = {
    adapter: 'secrets_manager',
    source: 'secrets_manager',
    secrets,
  };
  const size = await storage.putJson(projectId, storage.bucket, `${prefix}/snapshot.json`, manifest);
  return { size_bytes: size, extra: { count: secrets.length } };
}

async function restore(ctx, snapshotDoc) {
  const { projectId } = ctx;
  const secrets = (snapshotDoc && snapshotDoc.secrets) || [];
  const restored = [];
  for (const secret of secrets) {
    if (!secret || !secret.name || !secret.ciphertext) continue;
    const body = {
      project_id: projectId,
      name: secret.name,
      ciphertext: secret.ciphertext,
      key_name: secret.key_name,
      key_version: secret.key_version,
      metadata: secret.metadata,
    };
    const res = await call('secrets_manager', 'POST', '/api/v1/secrets', { projectId, data: body });
    if (res.status === 409) {
      const listed = await json('secrets_manager', 'GET', '/api/v1/secrets', { projectId });
      const rows = Array.isArray(listed.secrets) ? listed.secrets : [];
      const existing = rows.find((r) => r && r.name === secret.name);
      if (existing && existing.id) {
        await json('secrets_manager', 'PATCH', `/api/v1/secrets/${encodeURIComponent(existing.id)}`, {
          projectId,
          data: body,
        });
        restored.push({ name: secret.name, updated: true });
        continue;
      }
    } else if (res.status >= 400) {
      const { throwUpstream } = require('../utils/conductor');
      throwUpstream('secrets_manager', res);
    }
    restored.push({ name: secret.name, created: true });
  }
  return { ok: true, restored };
}

module.exports = { snapshot, restore };
