'use strict';

const { fail } = require('../../../shared/crudCore');
const { proxy } = require('../../../shared/conductorProxy');

function filePath(projectId, bucket, key) {
  return `/api/services/storage_manager/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files/${String(key).split('/').map(encodeURIComponent).join('/')}`;
}

async function putObject(item, projectId, body = {}) {
  const bucket = body.bucket || item.bucket;
  const key = body.key || body.path;
  if (!bucket) throw fail(400, 'bucket required on endpoint or body');
  if (!key) throw fail(400, 'key required');
  if (!process.env.CONDUCTOR_URL && !process.env.CONDUCTOR_INTERNAL_BASE_URL) {
    throw fail(503, 'CONDUCTOR_URL required to reach storage_manager');
  }
  const content = body.content != null ? body.content : (body.body != null ? body.body : '');
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), body.encoding || 'utf8');
  const res = await proxy('POST', filePath(projectId, bucket, key), {
    projectId,
    data: buf,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (res.status >= 400) throw fail(res.status, res.data?.error?.message || `storage_manager ${res.status}`);
  return { ok: true, bucket, key, result: res.data };
}

async function getObject(item, projectId, body = {}) {
  const bucket = body.bucket || item.bucket;
  const key = body.key || body.path;
  if (!bucket) throw fail(400, 'bucket required on endpoint or body');
  if (!key) throw fail(400, 'key required');
  if (!process.env.CONDUCTOR_URL && !process.env.CONDUCTOR_INTERNAL_BASE_URL) {
    throw fail(503, 'CONDUCTOR_URL required to reach storage_manager');
  }
  const res = await proxy('GET', filePath(projectId, bucket, key), {
    projectId,
    responseType: 'arraybuffer',
  });
  if (res.status >= 400) {
    const msg = Buffer.isBuffer(res.data) ? res.data.toString('utf8') : (res.data?.error?.message || `storage_manager ${res.status}`);
    throw fail(res.status, msg);
  }
  const raw = res.data;
  const text = Buffer.isBuffer(raw) ? raw.toString(body.encoding || 'utf8') : (typeof raw === 'string' ? raw : JSON.stringify(raw));
  return { ok: true, bucket, key, content: text };
}

module.exports = { putObject, getObject };
