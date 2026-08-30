'use strict';

const { Job } = require('../models');
const { fail } = require('../../../shared/crudCore');
const { StorageClient, BACKUP_BUCKET } = require('./StorageClient');
const { getAdapter } = require('../adapters');

function safeSegment(value, fallback) {
  const s = String(value == null ? '' : value).trim() || fallback;
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 128) || fallback;
}

function snapshotPrefix(source, resource, timestamp, jobId) {
  return `${safeSegment(source, 'source')}/${safeSegment(resource, 'default')}/${timestamp}/${jobId}`;
}

function compactTimestamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-');
}

class JobService {
  constructor({ storage } = {}) {
    this.storage = storage || new StorageClient();
  }

  assertProject(projectId) {
    if (!projectId || !String(projectId).trim()) throw fail(400, 'project_id required');
    return String(projectId).trim();
  }

  async create(body = {}) {
    const projectId = this.assertProject(body.project_id);
    const source = String(body.source || '').trim();
    if (!source) throw fail(400, 'source is required');
    const adapter = getAdapter(source);
    const resource = String(body.resource || 'default').trim() || 'default';
    const vault = String(body.vault || 'default').trim() || 'default';

    const job = await Job.create({
      project_id: projectId,
      source,
      resource,
      vault,
      status: 'running',
      size_bytes: 0,
      storage_key: '',
      error: '',
    });

    const timestamp = compactTimestamp();
    const prefix = snapshotPrefix(source, resource, timestamp, job.id);
    const ctx = {
      projectId,
      source,
      resource,
      vault,
      jobId: job.id,
      prefix,
      storage: this.storage,
      dest: body.dest || '',
    };

    try {
      await this.storage.ensureBucket(projectId, BACKUP_BUCKET);
      const result = await adapter.snapshot(ctx);
      const size = Number((result && result.size_bytes) || 0);
      await Job.update(job.id, {
        status: 'completed',
        size_bytes: size,
        storage_key: prefix,
        error: '',
      });
    } catch (err) {
      await Job.update(job.id, {
        status: 'failed',
        error: String(err.message || err).slice(0, 2000),
      });
      try {
        const { proxy } = require('../../../shared/conductorProxy');
        await proxy({
          service: 'slack_manager',
          method: 'POST',
          path: '/api/v1/messages',
          projectId,
          body: { project_id: projectId, text: `backup failed: ${source}/${resource} ${err.message}` },
        });
      } catch (_) { /* notify is best-effort */ }
    }
    return this.get(job.id, projectId);
  }

  async list(projectId) {
    this.assertProject(projectId);
    const rows = await Job.findAll({ where: { project_id: projectId } });
    return [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  async get(id, projectId, { signed = false } = {}) {
    this.assertProject(projectId);
    const rows = await Job.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) throw fail(404, 'job not found');
    const job = rows[0];
    if (!signed) return job;
    return this.withDownload(job);
  }

  async withDownload(job) {
    const out = JSON.parse(JSON.stringify(job));
    if (!out.storage_key || out.status !== 'completed') return out;
    try {
      const signed = await this.storage.signedDownloadUrl(
        out.project_id,
        BACKUP_BUCKET,
        `${out.storage_key}/snapshot.json`
      );
      out.download_url = signed.url || signed.signed_url || null;
      out.download_expires_at = signed.expires_at || null;
    } catch {
      out.download_url = null;
    }
    return out;
  }

  async restore(id, projectId, body = {}) {
    this.assertProject(projectId);
    const job = await this.get(id, projectId);
    if (job.status !== 'completed' || !job.storage_key) {
      throw fail(409, 'job has no completed snapshot to restore');
    }
    const adapter = getAdapter(job.source);
    let snapshotDoc = null;
    try {
      snapshotDoc = await this.storage.getJson(projectId, BACKUP_BUCKET, `${job.storage_key}/snapshot.json`);
    } catch (err) {
      throw fail(502, `snapshot manifest missing: ${err.message}`);
    }
    const ctx = {
      projectId,
      source: job.source,
      resource: job.resource,
      vault: job.vault,
      jobId: job.id,
      prefix: job.storage_key,
      storage: this.storage,
      dest: body.dest || '',
    };
    const result = await adapter.restore(ctx, snapshotDoc);
    return { job, restore: result };
  }
}

module.exports = { JobService, snapshotPrefix, compactTimestamp };
