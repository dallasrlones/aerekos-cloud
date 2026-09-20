'use strict';

const Docker = require('dockerode');
const { AiEngine, AiModelConfig } = require('../models');
const { conductorBase, authHeaders } = require('../../../shared/conductorProxy');
const {
  catalogList,
  getKind,
  namesFor,
  integrationNames,
  resolveEndpoint,
  mayAutoStart,
} = require('./engineCatalog');

function httpError(status, message, code) {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}

class EngineService {
  constructor(deps = {}) {
    this.Engine = deps.Engine || AiEngine;
    this.Model = deps.Model || AiModelConfig;
    this.docker = deps.docker || new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
    this.fetchFn = deps.fetchFn || fetch.bind(globalThis);
    this.callerToken = '';
  }

  useToken(token) {
    this.callerToken = String(token || '').replace(/^Bearer\s+/i, '').trim();
    return this;
  }

  headers() {
    const base = authHeaders('');
    if (this.callerToken) base.Authorization = `Bearer ${this.callerToken}`;
    return base;
  }

  async conductorGet(path) {
    const res = await this.fetchFn(`${conductorBase()}${path}`, {
      headers: this.headers(),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async conductorPost(path, body) {
    const res = await this.fetchFn(`${conductorBase()}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  catalog() {
    return catalogList();
  }

  async listWorkers() {
    const res = await this.conductorGet('/api/workers');
    let rows = res.data?.workers;
    if (!Array.isArray(rows) || !rows.length) {
      const fleet = await this.conductorGet('/api/fleet/capacity');
      rows = fleet.data?.hosts || [];
    }
    return (Array.isArray(rows) ? rows : []).map((w) => ({
      id: w.id,
      hostname: w.hostname || w.display_name || '',
      display_name: w.display_name || w.hostname || '',
      ip_address: w.ip_address || w.ip || '',
      status: w.status,
    }));
  }

  async localWorkerId(workers) {
    if (process.env.WORKER_ID || process.env.AI_ENGINE_WORKER_ID) {
      return String(process.env.WORKER_ID || process.env.AI_ENGINE_WORKER_ID);
    }
    let hn = '';
    try {
      const info = await this.docker.info();
      hn = String(info?.Name || '').trim();
    } catch { /* */ }
    const hit = (workers || []).find((w) => w.hostname === hn || w.display_name === hn);
    return hit?.id || '';
  }

  async inspectOnWorker(workerId, name) {
    const res = await this.conductorGet(
      `/api/workers/${encodeURIComponent(workerId)}/containers/${encodeURIComponent(name)}`,
    );
    if (res.status >= 400) return null;
    return res.data?.container || res.data || null;
  }

  async inspectLocal(kind) {
    for (const name of namesFor(kind)) {
      try {
        const info = await this.docker.getContainer(name).inspect();
        if (info) return { name, info };
      } catch { /* next name */ }
    }
    return null;
  }

  async inspectNamed(workerId, kind) {
    if (workerId) {
      for (const name of namesFor(kind)) {
        const info = await this.inspectOnWorker(workerId, name);
        if (info && (info.id || info.Id || info.name || info.running != null)) {
          return { name, info };
        }
      }
    }
    return this.inspectLocal(kind);
  }

  runningOf(info) {
    if (!info) return false;
    if (info.running === true) return true;
    if (info.State?.Running === true) return true;
    return String(info.state || info.State?.Status || '').toLowerCase() === 'running';
  }

  containerIdOf(info) {
    return String(info?.id || info?.Id || info?.container_id || '');
  }

  serialize(row) {
    return {
      id: row.id,
      kind: row.kind,
      worker_id: row.worker_id,
      worker_hostname: row.worker_hostname,
      status: row.status,
      container_name: row.container_name,
      container_id: row.container_id,
      host_port: Number(row.host_port || 0) || 0,
      endpoint: row.endpoint,
      integration: row.integration,
      auto_start: mayAutoStart(row.kind),
    };
  }

  async findByKind(kind) {
    const rows = await this.Engine.findAll({ where: { kind } });
    return rows[0] || null;
  }

  async upsertRow(fields) {
    const existing = await this.findByKind(fields.kind);
    if (existing) {
      await this.Engine.update(existing.id, fields);
      return (await this.Engine.findAll({ where: { id: existing.id } }))[0] || { ...existing, ...fields };
    }
    return this.Engine.create(fields);
  }

  async syncIntegrations(engine, workers, aiManagerWorkerId) {
    const names = integrationNames(engine.kind);
    if (!names.length) return;
    const worker = (workers || []).find((w) => w.id === engine.worker_id) || {
      id: engine.worker_id,
      ip_address: '',
    };
    const endpoint = resolveEndpoint(engine.kind, worker, aiManagerWorkerId);
    if (!endpoint) return;
    if (engine.endpoint !== endpoint) {
      await this.Engine.update(engine.id, { endpoint });
      engine.endpoint = endpoint;
    }
    const rows = await this.Model.findAll({});
    for (const row of rows) {
      if (!names.includes(row.name)) continue;
      if (row.endpoint === endpoint) continue;
      await this.Model.update(row.id, { endpoint });
    }
  }

  async refreshOne(row, workers, aiManagerWorkerId) {
    const found = await this.inspectNamed(row.worker_id, row.kind);
    const running = this.runningOf(found?.info);
    const missing = !found;
    const status = missing ? 'missing' : running ? 'running' : 'stopped';
    const patch = {
      status,
      container_name: found?.name || row.container_name,
      container_id: this.containerIdOf(found?.info) || row.container_id,
    };
    const worker = (workers || []).find((w) => w.id === row.worker_id);
    if (worker) patch.worker_hostname = worker.display_name || worker.hostname;
    patch.endpoint = resolveEndpoint(row.kind, worker || { id: row.worker_id }, aiManagerWorkerId);
    await this.Engine.update(row.id, patch);
    const fresh = { ...row, ...patch };
    if (status === 'running') await this.syncIntegrations(fresh, workers, aiManagerWorkerId);
    return fresh;
  }

  async list() {
    await this.seedFromHost().catch(() => {});
    const workers = await this.listWorkers().catch(() => []);
    const localId = await this.localWorkerId(workers);
    const rows = await this.Engine.findAll({});
    const out = [];
    for (const row of rows) {
      try {
        out.push(this.serialize(await this.refreshOne(row, workers, localId)));
      } catch {
        out.push(this.serialize(row));
      }
    }
    return { engines: out, workers, catalog: this.catalog() };
  }

  async seedFromHost() {
    const workers = await this.listWorkers().catch(() => []);
    const localId = await this.localWorkerId(workers);
    const existing = await this.Engine.findAll({});
    const have = new Set(existing.map((r) => r.kind));
    const pool = workers.length ? workers : [];
    for (const spec of catalogList()) {
      if (have.has(spec.kind)) continue;
      let hit = null;
      let worker = null;
      for (const w of pool) {
        const found = await this.inspectNamed(w.id, spec.kind);
        if (found) {
          hit = found;
          worker = w;
          break;
        }
      }
      if (!hit) {
        hit = await this.inspectLocal(spec.kind);
        worker = pool.find((w) => w.id === localId) || pool[0] || {
          id: localId || process.env.AI_ENGINE_WORKER_ID || '',
          hostname: '',
          display_name: '',
        };
      }
      if (!worker.id) {
        worker.id = localId || process.env.AI_ENGINE_WORKER_ID || 'ccb6c3bb-c8b7-483e-9bb8-06e9271e2961';
      }
      if (!hit || !worker.id) continue;
      const running = this.runningOf(hit.info);
      const row = await this.upsertRow({
        kind: spec.kind,
        worker_id: worker.id,
        worker_hostname: worker.display_name || worker.hostname || '',
        status: running ? 'running' : 'stopped',
        container_name: hit.name,
        container_id: this.containerIdOf(hit.info),
        host_port: String(spec.host_port || 0),
        endpoint: resolveEndpoint(spec.kind, worker, localId),
        integration: spec.integration || '',
      });
      if (running) await this.syncIntegrations(row, workers, localId);
    }
  }

  async place({ kind, worker_id, start }) {
    const spec = getKind(kind);
    const workers = await this.listWorkers();
    const worker = workers.find((w) => w.id === worker_id);
    if (!worker) throw httpError(404, 'worker not found');
    const localId = await this.localWorkerId(workers);
    const found = await this.inspectNamed(worker.id, spec.kind);
    const explicitStart = start === true || start === 'true' || start === 1;
    const running = this.runningOf(found?.info);

    if (!found) {
      if (!mayAutoStart(spec.kind) && !explicitStart) {
        throw httpError(409, `will not auto-start ${spec.kind}`, 'NO_AUTO_START');
      }
      if (!mayAutoStart(spec.kind) && explicitStart) {
        throw httpError(409, `${spec.kind} is missing on this worker; start the existing image first`, 'MISSING');
      }
      await this.createStartable(spec, worker);
    } else if (!running) {
      if (!mayAutoStart(spec.kind) && !explicitStart) {
        const row = await this.upsertRow({
          kind: spec.kind,
          worker_id: worker.id,
          worker_hostname: worker.display_name || worker.hostname || '',
          status: 'stopped',
          container_name: found.name,
          container_id: this.containerIdOf(found.info),
          host_port: String(spec.host_port || 0),
          endpoint: resolveEndpoint(spec.kind, worker, localId),
          integration: spec.integration || '',
        });
        return this.serialize(row);
      }
      await this.startNamed(worker.id, found.name);
    }

    const again = await this.inspectNamed(worker.id, spec.kind);
    const nowRunning = this.runningOf(again?.info);
    const row = await this.upsertRow({
      kind: spec.kind,
      worker_id: worker.id,
      worker_hostname: worker.display_name || worker.hostname || '',
      status: nowRunning ? 'running' : 'stopped',
      container_name: again?.name || spec.container_name,
      container_id: this.containerIdOf(again?.info),
      host_port: String(spec.host_port || 0),
      endpoint: resolveEndpoint(spec.kind, worker, localId),
      integration: spec.integration || '',
    });
    if (nowRunning) await this.syncIntegrations(row, workers, localId);
    return this.serialize(row);
  }

  async createStartable(spec, worker) {
    const port = Number(spec.host_port || 0);
    const body = {
      name: spec.container_name,
      image: spec.image,
      runtime: spec.runtime || undefined,
      restartPolicy: 'unless-stopped',
    };
    if (port) {
      body.portBindings = { '8000/tcp': [{ HostPort: String(port) }] };
    }
    if (spec.kind === 'ollama') {
      body.portBindings = { '11434/tcp': [{ HostPort: '11434' }] };
    }
    if (spec.kind === 'icarus_workspace') {
      body.binds = ['/home/aerekos/work:/home/aerekos/work'];
      body.cmd = ['sh', '-c', 'apk add --no-cache git >/dev/null 2>&1 || true; exec sleep infinity'];
      body.workingDir = '/home/aerekos/work';
    }
    if (spec.kind === 'icarus_browser') {
      body.portBindings = { '9222/tcp': [{ HostPort: String(spec.host_port || 9222) }] };
      body.binds = [
        '/home/aerekos/work/aerekos/aerekos-cloud/worker/ai_manager/api/services/browserDriver.js:/app/browserDriver.js:ro',
      ];
      body.cmd = ['node', '/app/browserDriver.js'];
      body.env = ['PORT=9222'];
    }
    const res = await this.conductorPost(
      `/api/workers/${encodeURIComponent(worker.id)}/containers`,
      body,
    );
    if (res.status >= 400) {
      throw httpError(res.status, res.data?.error?.message || res.data?.error || 'remote create failed');
    }
    return res.data;
  }

  async healNamed(workerId, name, info) {
    const { shouldHeal } = require('./ContainerHeal');
    const decision = shouldHeal(name, info || {});
    if (!decision.heal) return { ...decision, started: false };
    await this.startNamed(workerId, name);
    return { ...decision, started: true };
  }

  async startNamed(workerId, name) {
    const res = await this.conductorPost(
      `/api/workers/${encodeURIComponent(workerId)}/containers/${encodeURIComponent(name)}/start`,
      {},
    );
    if (res.status >= 400) {
      throw httpError(res.status, res.data?.error?.message || res.data?.error || 'start failed');
    }
  }

  async stopNamed(workerId, name) {
    const res = await this.conductorPost(
      `/api/workers/${encodeURIComponent(workerId)}/containers/${encodeURIComponent(name)}/stop`,
      {},
    );
    if (res.status >= 400) {
      throw httpError(res.status, res.data?.error?.message || res.data?.error || 'stop failed');
    }
  }

  async get(id) {
    const rows = await this.Engine.findAll({ where: { id } });
    if (!rows.length) throw httpError(404, 'engine not found');
    const workers = await this.listWorkers().catch(() => []);
    const localId = await this.localWorkerId(workers);
    return this.serialize(await this.refreshOne(rows[0], workers, localId));
  }

  async start(id) {
    const rows = await this.Engine.findAll({ where: { id } });
    if (!rows.length) throw httpError(404, 'engine not found');
    const row = rows[0];
    await this.startNamed(row.worker_id, row.container_name);
    const workers = await this.listWorkers().catch(() => []);
    const localId = await this.localWorkerId(workers);
    return this.serialize(await this.refreshOne({ ...row, status: 'running' }, workers, localId));
  }

  async stop(id) {
    const rows = await this.Engine.findAll({ where: { id } });
    if (!rows.length) throw httpError(404, 'engine not found');
    const row = rows[0];
    await this.stopNamed(row.worker_id, row.container_name);
    await this.Engine.update(id, { status: 'stopped' });
    return this.serialize({ ...row, status: 'stopped' });
  }
}

module.exports = { EngineService };
