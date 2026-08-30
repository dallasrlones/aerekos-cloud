'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { DockerService } = require('./DockerService');
const { proxy } = require('../../../shared/conductorProxy');

function skipDocker() {
  return process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true';
}

/**
 * CodeBuild analog used only by cicd_manager: materialize source, docker build, return image tag.
 * compute_manager has docker.sock; it does not create a task here.
 */
class BuildService {
  constructor(deps = {}) {
    this.docker = deps.docker || new DockerService();
  }

  async shipBuildLogs(projectId, source, message, level = 'info') {
    try {
      await proxy({
        service: 'logs_manager',
        method: 'POST',
        path: '/api/v1/logs',
        projectId,
        body: { project_id: projectId, source, level, message: String(message).slice(0, 8000) },
        timeout: 10000,
      });
    } catch (_) { /* */ }
  }

  async build(body) {
    const projectId = body.project_id;
    if (!projectId) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
    const dockerfile = String(body.dockerfile || 'Dockerfile').replace(/^\/+/, '');
    const name = String(body.name || 'app').replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 40);
    const sha = String(body.sha || Date.now().toString(36)).replace(/[^a-zA-Z0-9]+/g, '').slice(0, 12);
    const tag = String(body.tag || `aer-cmp-${name}:${sha}`).toLowerCase();
    const logSource = body.log_source || `cicd.${body.pipeline_id || 'build'}`;

    if (skipDocker()) {
      await this.shipBuildLogs(projectId, logSource, `skip docker build ${tag}`);
      return { image: tag, skipped: true, logs: 'SKIP_DOCKER' };
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aer-cmp-build-'));
    try {
      const ctx = path.join(tmp, 'ctx');
      fs.mkdirSync(ctx, { recursive: true });
      if (body.repo_id) {
        await this.materializeGit(projectId, body.repo_id, body.ref || 'main', ctx);
      } else if (body.source_object) {
        await this.materializeStorage(projectId, body.source_object, ctx);
      } else {
        const e = new Error('repo_id or source_object required');
        e.status = 400;
        throw e;
      }
      const df = path.join(ctx, dockerfile);
      if (!fs.existsSync(df)) {
        const e = new Error(`Dockerfile not found: ${dockerfile}`);
        e.status = 400;
        throw e;
      }
      await this.shipBuildLogs(projectId, logSource, `building ${tag}`);
      const out = await this.docker.buildImage({ contextDir: ctx, dockerfile, tag });
      await this.shipBuildLogs(projectId, logSource, (out.logs || '').slice(-4000) || `built ${tag}`);
      try {
        await proxy({
          service: 'registry_manager',
          method: 'POST',
          path: '/api/v1/artifacts',
          projectId,
          body: { project_id: projectId, name: tag, kind: 'docker', version: sha, uri: tag },
          timeout: 10000,
        });
      } catch (_) { /* */ }
      return { image: tag, logs: out.logs || '' };
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* */ }
    }
  }

  async materializeGit(projectId, repoId, ref, dest) {
    const res = await proxy({
      service: 'git_manager',
      method: 'GET',
      path: `/api/v1/repos/${encodeURIComponent(repoId)}/bundle`,
      projectId,
      timeout: 120000,
      responseType: 'arraybuffer',
    });
    if (res.status >= 400) {
      const e = new Error(res.data?.error?.message || `git bundle failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    const buf = Buffer.from(res.data || []);
    const archive = path.join(path.dirname(dest), 'src.bundle');
    fs.writeFileSync(archive, buf);
    const head = buf.slice(0, 24).toString('utf8');
    if (head.startsWith('# v2 git bundle') || head.startsWith('# v3 git bundle')) {
      await execFileAsync('git', ['clone', archive, dest], { timeout: 120000 });
      try {
        await execFileAsync('git', ['checkout', ref], { cwd: dest, timeout: 30000 });
      } catch (_) { /* default branch */ }
    } else {
      await execFileAsync('tar', ['-xf', archive, '-C', dest], { timeout: 120000 });
    }
  }

  async materializeStorage(projectId, objectKey, dest) {
    const [bucket, ...rest] = String(objectKey).split('/');
    const key = rest.join('/') || bucket;
    const bucketName = rest.length ? bucket : 'compute-sources';
    const fileKey = rest.length ? key : objectKey;
    const res = await proxy({
      service: 'storage_manager',
      method: 'GET',
      path: `/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucketName)}/files/${encodeURIComponent(fileKey)}`,
      projectId,
      timeout: 120000,
      responseType: 'arraybuffer',
    });
    if (res.status >= 400) {
      const e = new Error(res.data?.error?.message || `storage download failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    const zip = path.join(path.dirname(dest), 'src.zip');
    fs.writeFileSync(zip, Buffer.from(res.data || []));
    try {
      await execFileAsync('unzip', ['-q', zip, '-d', dest], { timeout: 120000 });
    } catch {
      await execFileAsync('tar', ['-xf', zip, '-C', dest], { timeout: 120000 });
    }
  }
}

module.exports = { BuildService };
