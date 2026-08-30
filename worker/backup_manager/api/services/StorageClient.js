'use strict';

const { call, json, toBuffer, throwUpstream } = require('../utils/conductor');
const { fail } = require('../../../shared/crudCore');

const BACKUP_BUCKET = process.env.BACKUP_BUCKET || 'aerekos-backups';
const STORAGE = 'storage_manager';

function filesBase(projectId, bucket) {
  return `/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files`;
}

function filePath(projectId, bucket, key) {
  const k = String(key || '').replace(/^\/+/, '');
  if (!k) throw fail(400, 'storage key required');
  return `${filesBase(projectId, bucket)}/${k}`;
}

class StorageClient {
  constructor({ bucket } = {}) {
    this.bucket = bucket || BACKUP_BUCKET;
  }

  async ensureBucket(projectId, name) {
    const bucket = name || this.bucket;
    const res = await call(STORAGE, 'POST', `/api/projects/${encodeURIComponent(projectId)}/buckets`, {
      projectId,
      data: { name: bucket },
    });
    if (res.status === 409 || (res.status >= 200 && res.status < 300)) return bucket;
    throwUpstream(STORAGE, res);
    return bucket;
  }

  async listFiles(projectId, bucket, { prefix = '', maxKeys = 1000 } = {}) {
    const out = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const qs = new URLSearchParams({
        prefix: prefix || '',
        delimiter: '',
        maxKeys: String(maxKeys),
        offset: String(offset),
      });
      const data = await json(STORAGE, 'GET', `${filesBase(projectId, bucket)}?${qs}`, { projectId });
      const files = Array.isArray(data.files) ? data.files : [];
      out.push(...files);
      hasMore = Boolean(data.hasMore);
      offset += files.length;
      if (!files.length) break;
    }
    return out;
  }

  async getObject(projectId, bucket, key) {
    const res = await call(STORAGE, 'GET', filePath(projectId, bucket, key), {
      projectId,
      responseType: 'arraybuffer',
      timeout: 120000,
    });
    if (res.status >= 400) throwUpstream(STORAGE, res);
    return toBuffer(res.data);
  }

  async putObject(projectId, bucket, key, body, contentType = 'application/octet-stream') {
    const buf = toBuffer(body);
    const res = await call(STORAGE, 'POST', filePath(projectId, bucket, key), {
      projectId,
      data: buf,
      headers: { 'Content-Type': contentType },
      timeout: 120000,
    });
    if (res.status >= 400) throwUpstream(STORAGE, res);
    return { key, size: buf.length, data: res.data };
  }

  async putJson(projectId, bucket, key, obj) {
    const buf = Buffer.from(`${JSON.stringify(obj, null, 2)}\n`);
    // storage_manager files API accepts octet-stream (JSON content-type is rejected).
    await this.putObject(projectId, bucket, key, buf, 'application/octet-stream');
    return buf.length;
  }

  async getJson(projectId, bucket, key) {
    const buf = await this.getObject(projectId, bucket, key);
    return JSON.parse(buf.toString('utf8'));
  }

  async copyObject(projectId, fromBucket, fromKey, toBucket, toKey) {
    const buf = await this.getObject(projectId, fromBucket, fromKey);
    await this.putObject(projectId, toBucket, toKey, buf);
    return buf.length;
  }

  async signedDownloadUrl(projectId, bucket, key, ttlSeconds = 3600) {
    const data = await json(
      STORAGE,
      'POST',
      `${filePath(projectId, bucket, key)}/signed-url/download`,
      { projectId, data: { ttl_seconds: ttlSeconds } }
    );
    return data && (data.url || data.signed_url || data.download_url) ? data : { url: null, ...data };
  }
}

module.exports = { StorageClient, BACKUP_BUCKET };
