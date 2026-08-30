const { CicdPipeline } = require('../models');
class CicdPipelineService {
  constructor() { this.M = CicdPipeline; }
  assertP(p) { if (!p||!String(p).trim()){const e=new Error('project_id required');e.status=400;throw e;} }
  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name||'').trim();
    if (!name) { const e = new Error('name required'); e.status=400; throw e; }
    const d = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (d.length) { const e = new Error('name taken'); e.status=409; throw e; }
    return this.M.create(body);
  }
  async list(projectId) { this.assertP(projectId); return this.M.findAll({ where: { project_id: projectId } }); }
  async get(id, projectId) { this.assertP(projectId); const r = await this.M.findAll({ where: { id, project_id: projectId } }); if (!r.length){const e=new Error('Not found');e.status=404;throw e;} return r[0]; }
  async update(id, projectId, body) {
    await this.get(id, projectId);
    const patch = { ...(body || {}) };
    delete patch.id; delete patch.project_id; delete patch.created_at; delete patch.updated_at;
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) { const e = new Error('name taken'); e.status = 409; throw e; }
      patch.name = name;
    }
    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectId);
  }
  async del(id, projectId) { await this.get(id, projectId); await this.M.delete(id); return { deleted:true, id }; }

  async deploy(id, projectId, body = {}) {
    const { proxy } = require('../../../shared/conductorProxy');
    const row = await this.get(id, projectId);
    const repoId = body.repo_id || row.repo_id;
    const sourceObject = body.source_object || row.source_object;
    const dockerfile = body.dockerfile || row.dockerfile || 'Dockerfile';
    const name = String(body.container_name || body.task_name || '')
      .trim()
      || String(row.name || 'app').replace(/^(deploy|upload)-/, '').trim()
      || 'app';
    if (!repoId && !sourceObject && !row.target_image) {
      const e = new Error('deploy requires repo_id, source_object, or target_image');
      e.status = 400;
      throw e;
    }
    let image = String(body.image || row.target_image || '').trim();
    const results = [];
    if (repoId || sourceObject) {
      const built = await proxy({
        service: 'compute_manager',
        method: 'POST',
        path: '/api/v1/builds',
        projectId,
        body: {
          project_id: projectId,
          repo_id: repoId || undefined,
          ref: body.ref || body.git_ref || row.git_ref || 'main',
          source_object: sourceObject || undefined,
          dockerfile,
          name,
          pipeline_id: id,
          log_source: `cicd.${id}`,
        },
        timeout: 600000,
      });
      results.push({ step: 'build-image', status: built.status, data: built.data && built.data.error ? built.data.error : { image: built.data?.image } });
      if (built.status >= 400) {
        await this.M.update(id, { state: 'failed' });
        return { pipeline: await this.get(id, projectId), action: 'deploy', ok: false, results };
      }
      image = built.data?.image || image;
    }
    if (!image) {
      const e = new Error('build produced no image');
      e.status = 500;
      throw e;
    }
    await this.M.update(id, { target_image: image });
    const targetId = body.target_container_id || row.target_container_id;
    if (targetId) {
      const replaced = await proxy({
        service: 'compute_manager',
        method: 'POST',
        path: `/api/v1/tasks/${encodeURIComponent(targetId)}/replace-image`,
        projectId,
        body: { project_id: projectId, image, force: body.force === true },
        timeout: 180000,
      });
      results.push({ step: 'replace-image', status: replaced.status });
      if (replaced.status >= 400) {
        await this.M.update(id, { state: 'failed' });
        return { pipeline: await this.get(id, projectId), action: 'deploy', ok: false, results };
      }
      await this.M.update(id, { state: 'succeeded', target_container_id: targetId, target_image: image });
      return { pipeline: await this.get(id, projectId), action: 'deploy', ok: true, results, task: replaced.data?.task };
    }
    const created = await proxy({
      service: 'compute_manager',
      method: 'POST',
      path: '/api/v1/tasks',
      projectId,
      body: {
        project_id: projectId,
        name,
        image,
        run_mode: body.run_mode || 'service',
        env: {
          ...(body.env && typeof body.env === 'object' ? body.env : {}),
          AEREKOS_SOURCE: repoId ? 'git' : (sourceObject ? 'upload' : 'image'),
          AEREKOS_REPO_ID: repoId || '',
          AEREKOS_GIT_REF: body.ref || row.git_ref || 'main',
          AEREKOS_DOCKERFILE: dockerfile,
        },
        port_bindings: body.port_bindings || undefined,
        command: body.command || undefined,
      },
      timeout: 180000,
    });
    results.push({ step: 'create-task', status: created.status });
    const taskId = created.data?.task?.id;
    if (taskId) await this.M.update(id, { target_container_id: taskId, target_image: image, state: created.status < 400 ? 'succeeded' : 'failed' });
    else await this.M.update(id, { state: 'failed', target_image: image });
    return {
      pipeline: await this.get(id, projectId),
      action: 'deploy',
      ok: created.status < 400,
      results,
      task: created.data?.task,
    };
  }

  async run(id, projectId, body = {}) {
    const axios = require('axios');
    const { conductorBase, authHeaders } = require('../../../shared/conductorProxy');
    const row = await this.get(id, projectId);
    const action = String(body.action || 'apply-stack');
    if (action === 'fleet') {
      await this.M.update(id, { state: 'running' });
      try {
        return await this.fleet(id, projectId, body);
      } catch (e) {
        await this.M.update(id, { state: 'failed' }).catch(() => {});
        throw e;
      }
    }
    if (action === 'deploy' || action === 'build-image') {
      await this.M.update(id, { state: 'running' });
      try {
        return await this.deploy(id, projectId, body);
      } catch (e) {
        await this.M.update(id, { state: 'failed' }).catch(() => {});
        throw e;
      }
    }
    await this.M.update(id, { state: 'running' });
    const results = [];
    const headers = authHeaders(projectId);
    const base = conductorBase();
    if (action === 'apply-stack' || action === 'apply') {
      const res = await axios.post(`${base}/api/projects/${encodeURIComponent(projectId)}/stack/apply`, body.stack || {}, {
        headers, timeout: 120000, validateStatus: () => true,
      });
      results.push({ step: 'apply-stack', status: res.status, data: res.data && res.data.error ? res.data.error : { ok: res.status < 400 } });
      const hostname = body.hostname || process.env.EDGE_BOOTSTRAP_HOSTNAME;
      if (hostname && res.status < 400) {
        const bind = await axios.post(`${base}/api/edge/bind`, {
          project_id: projectId,
          task_id: body.task_id || process.env.EDGE_BOOTSTRAP_TASK_ID || '',
          hostname,
          port: Number(body.port || process.env.EDGE_BOOTSTRAP_PORT || 80),
        }, { headers, timeout: 30000, validateStatus: () => true });
        results.push({ step: 'hostname-bind', status: bind.status });
      }
    }
    let steps = [];
    try { steps = JSON.parse(row.steps_json || '[]'); } catch { steps = []; }
    if (!Array.isArray(steps)) steps = [];
    for (const step of steps) {
      const kind = String(step.kind || step.type || '').toLowerCase();
      if (kind === 'email' || kind === 'sms' || kind === 'slack') {
        results.push({ step: step.name || kind, skipped: true, reason: 'outbound_disabled' });
        continue;
      }
      try {
        if (step.url) {
          const res = await axios({
            method: step.method || 'POST',
            url: step.url,
            data: step.body,
            timeout: Number(step.timeout_ms || 30000),
            validateStatus: () => true,
            headers: { 'Content-Type': 'application/json', ...(step.headers || {}) },
          });
          results.push({ step: step.name || step.url, status: res.status });
        } else if (step.service && step.path) {
          const res = await axios({
            method: step.method || 'POST',
            url: `${base}/api/services/${step.service}${step.path.startsWith('/') ? step.path : `/${step.path}`}`,
            data: step.body || { project_id: projectId },
            timeout: Number(step.timeout_ms || 30000),
            validateStatus: () => true,
            headers,
          });
          results.push({ step: step.name || `${step.service}${step.path}`, status: res.status });
        }
      } catch (err) {
        results.push({ step: step.name || kind || 'step', error: err.message });
      }
    }
    const failed = results.some((r) => (r.status && r.status >= 400) || r.error);
    await this.M.update(id, { state: failed ? 'failed' : 'succeeded' });
    return { pipeline: await this.get(id, projectId), action, ok: !failed, results };
  }

  verifyWebhook(body, signature) {
    const secret = process.env.GIT_WEBHOOK_SECRET || '';
    if (!secret) return true;
    if (!signature) return false;
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
    } catch {
      return false;
    }
  }

  parseWorkflow(yml) {
    const jobs = [];
    if (!yml || typeof yml !== 'string') return { jobs, bind: null };
    const lines = yml.split('\n');
    let inJobs = false;
    let bind = null;
    for (const raw of lines) {
      const line = raw.replace(/\t/g, '  ');
      if (/^jobs\s*:/.test(line)) { inJobs = true; continue; }
      if (/^bind\s*:/.test(line)) { bind = {}; inJobs = false; continue; }
      if (inJobs) {
        const m = line.match(/^\s+-\s+(\w+)/) || line.match(/^\s+(\w+)\s*:/);
        if (m) jobs.push(m[1]);
        if (/^\S/.test(line) && !/^\s/.test(line)) inJobs = false;
      }
      if (bind && /^\s+hostname\s*:\s*(.+)/.test(line)) bind.hostname = line.split(':').slice(1).join(':').trim();
      if (bind && /^\s+port\s*:\s*(\d+)/.test(line)) bind.port = Number(line.match(/(\d+)/)[1]);
    }
    return { jobs: jobs.length ? jobs : null, bind };
  }

  async loadWorkflow(projectId, repoId, sha) {
    try {
      const { proxy } = require('../../../shared/conductorProxy');
      const blob = await proxy({
        service: 'git_manager',
        method: 'GET',
        path: `/api/v1/repos/${encodeURIComponent(repoId)}/blob?ref=${encodeURIComponent(sha || 'HEAD')}&path=${encodeURIComponent('.aerekos/workflows/deploy.yml')}`,
        projectId,
        timeout: 15000,
      });
      if (blob.status >= 400 || blob.data?.binary) return { jobs: null, bind: null };
      return this.parseWorkflow(blob.data?.content || '');
    } catch {
      return { jobs: null, bind: null };
    }
  }

  isFleetAllowed(projectId, repo, ref) {
    const SYSTEM = '9d8bde11-6933-4732-b746-602dcf72eaa5';
    const branch = String(ref || '').replace(/^refs\/heads\//, '') || 'main';
    return String(projectId) === SYSTEM && String(repo) === 'aerekos-cloud'
      && (branch === 'main' || String(ref || '').includes('refs/heads/main'));
  }

  async fleet(id, projectId, body = {}) {
    if (!this.isFleetAllowed(projectId, body.repo_name || body.repo || 'aerekos-cloud', body.ref)) {
      await this.M.update(id, { state: 'succeeded' });
      return {
        pipeline: await this.get(id, projectId),
        action: 'test',
        ok: true,
        results: [{ step: 'fleet-noop', status: 200, note: 'aerekos-cloud fleet only on system+main' }],
      };
    }
    if (this._fleetLock) {
      return { skipped: true, reason: 'fleet_in_progress', action: 'fleet' };
    }
    this._fleetLock = true;
    const results = [];
    try {
      const { proxy, conductorBase, authHeaders } = require('../../../shared/conductorProxy');
      const axios = require('axios');
      const sha = String(body.sha || 'HEAD').slice(0, 40);
      const version = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${sha.slice(0, 7)}`;
      const repoId = body.repo_id;
      if (!repoId) {
        const e = new Error('repo_id required to publish fleet release');
        e.status = 400;
        throw e;
      }
      const archive = await proxy({
        service: 'git_manager',
        method: 'GET',
        path: `/api/v1/repos/${encodeURIComponent(repoId)}/bundle`,
        projectId,
        timeout: 120000,
        responseType: 'arraybuffer',
      });
      if (archive.status >= 400) {
        await this.M.update(id, { state: 'failed' });
        return { pipeline: await this.get(id, projectId), action: 'fleet', ok: false, results: [{ step: 'bundle', status: archive.status }] };
      }
      const tar = await this.bundleToReleaseTar(archive.data);
      const headers = { ...authHeaders(projectId), 'Content-Type': 'application/gzip' };
      const pub = await axios.post(
        `${conductorBase()}/api/releases?version=${encodeURIComponent(version)}&notes=${encodeURIComponent(`merged ${sha}`)}`,
        tar,
        { headers, timeout: 120000, maxBodyLength: Infinity, validateStatus: () => true }
      );
      results.push({ step: 'publish', status: pub.status, version });
      if (pub.status >= 400) {
        await this.M.update(id, { state: 'failed' });
        return { pipeline: await this.get(id, projectId), action: 'fleet', ok: false, results };
      }
      try {
        await axios.post(`${conductorBase()}/api/fleet/updates/run-now`, {}, {
          headers: authHeaders(projectId), timeout: 15000, validateStatus: () => true,
        });
        results.push({ step: 'nudge-updaters', status: 200 });
      } catch (e) {
        results.push({ step: 'nudge-updaters', error: e.message });
      }
      await this.M.update(id, { state: 'succeeded' });
      return { pipeline: await this.get(id, projectId), action: 'fleet', ok: true, results, version };
    } finally {
      this._fleetLock = false;
    }
  }

  async bundleToReleaseTar(buf) {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { execFile } = require('child_process');
    const run = (cmd, args, cwd) => new Promise((resolve, reject) => {
      execFile(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (err) => err ? reject(err) : resolve());
    });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-fleet-'));
    const bundlePath = path.join(tmp, 'in.bundle');
    const src = path.join(tmp, 'src');
    const out = path.join(tmp, 'release.tar.gz');
    fs.writeFileSync(bundlePath, Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
    fs.mkdirSync(src, { recursive: true });
    try {
      try {
        await run('git', ['clone', '--depth', '1', bundlePath, src]);
      } catch {
        await run('tar', ['-C', src, '-xf', bundlePath]).catch(() => {});
      }
      await run('tar', [
        'czf', out,
        '--exclude=.git', '--exclude=node_modules', '--exclude=.env', '--exclude=data',
        '--exclude=.expo', '--exclude=coverage', '-C', src, '.',
      ]);
      return fs.readFileSync(out);
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  async runForRepo(projectId, body = {}, reqHeaders = {}) {
    this.assertP(projectId);
    if (!this.verifyWebhook({
      project_id: projectId,
      repo_id: body.repo_id,
      repo_name: body.repo_name || body.repo || '',
      ref: body.ref,
      sha: body.sha,
    }, reqHeaders['x-aerekos-signature'])) {
      const e = new Error('invalid webhook signature');
      e.status = 401;
      throw e;
    }
    const repo = String(body.repo_name || body.repo || '');
    const list = await this.list(projectId);
    const match = list.find((p) => String(p.repo || p.repo_name || '') === repo);
    if (!match) {
      return { skipped: true, reason: 'no_pipeline', repo };
    }
    const ref = String(body.ref || '');
    const branch = ref.replace(/^refs\/heads\//, '') || match.git_ref || 'main';
    const wf = match.repo_id
      ? await this.loadWorkflow(projectId, match.repo_id, body.sha || branch)
      : { jobs: null, bind: null };
    const jobs = wf.jobs || [];

    if (repo === 'aerekos-cloud') {
      if (this.isFleetAllowed(projectId, repo, ref || 'refs/heads/main')) {
        return this.run(match.id, projectId, { ...body, action: 'fleet', repo, repo_name: repo });
      }
      await this.M.update(match.id, { state: 'succeeded' });
      return {
        pipeline: await this.get(match.id, projectId),
        action: 'test',
        ok: true,
        results: [{ step: 'fleet-noop', status: 200, note: 'aerekos-cloud fleet only on system project main' }],
      };
    }
    if (repo === 'infra' || String(body.action || '') === 'apply-stack') {
      return this.run(match.id, projectId, { ...body, action: 'apply-stack' });
    }
    const wantTest = !jobs.length || jobs.includes('test');
    const wantDeploy = jobs.includes('deploy') || (!jobs.length && (match.target_container_id || match.repo_id || match.source_object));
    const wantFleet = jobs.includes('fleet');
    if (wantTest && !wantDeploy && !wantFleet) {
      await this.M.update(match.id, { state: 'succeeded' });
      return { pipeline: await this.get(match.id, projectId), action: 'test', ok: true, results: [{ step: 'record-push', status: 200 }] };
    }
    if (wantDeploy) {
      const deployed = await this.run(match.id, projectId, { ...body, action: 'deploy', environment: match.environment || 'prod' });
      if (!deployed.ok) return deployed;
      if (wf.bind && wf.bind.hostname && deployed.task?.id) {
        try {
          const { conductorBase, authHeaders } = require('../../../shared/conductorProxy');
          const axios = require('axios');
          await axios.post(`${conductorBase()}/api/edge/bind`, {
            project_id: projectId,
            task_id: deployed.task.id,
            hostname: wf.bind.hostname,
            port: wf.bind.port,
          }, { headers: authHeaders(projectId), timeout: 30000, validateStatus: () => true });
        } catch (_) { /* optional */ }
      }
      return deployed;
    }
    if (wantFleet) {
      return this.run(match.id, projectId, { ...body, action: 'fleet', repo, repo_name: repo });
    }
    const action = body.action || 'test';
    return this.run(match.id, projectId, { ...body, action });
  }
}
module.exports = { CicdPipelineService };
