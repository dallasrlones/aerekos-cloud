'use strict';

const { json, call, throwUpstream } = require('../utils/conductor');
const {
  getClickOps,
  sanitizeResource,
  collectionPath,
} = require('../../../shared/clickOpsCatalog');
const { fail } = require('../../../shared/crudCore');

const CREDENTIAL_SOURCES = new Set(['email_manager', 'sms_manager', 'slack_manager', 'auth_manager']);

function listFrom(data, ops) {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (ops && Array.isArray(data[ops.listKey])) return data[ops.listKey];
  if (Array.isArray(data)) return data;
  return [];
}

function listPath(ops, projectId) {
  const raw = (ops.listPath || ops.createPath || `${ops.proxyBase}/${ops.segment}`).replace(/\/apply$/, '');
  return String(raw).replace(/\{projectId\}/g, projectId || '');
}

async function snapshot(ctx) {
  const { projectId, source, resource, storage, prefix } = ctx;
  const ops = getClickOps(source);
  if (!ops) throw fail(400, `no click-ops catalog entry for ${source}`);
  const data = await json(source, 'GET', listPath(ops, projectId), { projectId });
  let records = listFrom(data, ops).map((row) => sanitizeResource(ops, row));
  if (resource && resource !== 'default') {
    records = records.filter((row) => row && (row.name === resource || String(row.id) === String(resource) || String(row[ops.idField]) === String(resource)));
  }
  if (CREDENTIAL_SOURCES.has(source)) {
    records = records.map((row) => sanitizeResource(ops, row));
  }
  const manifest = {
    adapter: 'generic',
    source,
    resource: resource || 'default',
    stackKey: ops.stackKey,
    records,
  };
  const size = await storage.putJson(projectId, storage.bucket, `${prefix}/snapshot.json`, manifest);
  return { size_bytes: size, extra: { count: records.length } };
}

async function restore(ctx, snapshotDoc) {
  const { projectId, source } = ctx;
  const ops = getClickOps(source);
  if (!ops) throw fail(400, `no click-ops catalog entry for ${source}`);
  const records = (snapshotDoc && snapshotDoc.records) || [];
  const path = collectionPath(ops, projectId);
  const restored = [];
  for (const item of records) {
    const body = sanitizeResource(ops, {
      project_id: projectId,
      ...(ops.defaults || {}),
      ...item,
    });
    delete body.id;
    delete body.created_at;
    delete body.updated_at;
    const res = await call(source, 'POST', path, { projectId, data: body });
    if (res.status >= 400 && res.status !== 409) throwUpstream(source, res);
    restored.push({ name: item && item.name, ok: true, status: res.status, data: res.data });
  }
  return { ok: true, restored };
}

module.exports = { snapshot, restore };
