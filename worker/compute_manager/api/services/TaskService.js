const { Task } = require('../models');
const { DockerService } = require('./DockerService');
const { FleetExec } = require('./FleetExec');
const { mergeRuntimeLimits, withRuntimeSpec } = require('../../../shared/dockerGpuHostConfig');

const NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function volumeBinds(volumes, projectId, environment) {
  return (Array.isArray(volumes) ? volumes : []).map((v) => {
    if (typeof v === 'string') return v;
    const vol = v.name ? `aerekos-vol-${String(projectId).slice(0, 8)}-${environment}-${v.name}` : v.source;
    return `${vol}:${v.target || v.mount || '/data'}`;
  });
}

function parseJson(raw, fallback) {
  try {
    if (raw == null || raw === '') return fallback;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

function toDockerPortBindings(obj) {
  if (!obj || typeof obj !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.includes('/') ? k : `${String(k)}/tcp`;
    out[key] = [{ HostPort: String(v) }];
  }
  return out;
}

class TaskService {
  /**
   * @param {{ Task?: typeof Task, docker?: import('./DockerService').DockerService }} [deps]
   */
  constructor(deps = {}) {
    this.Task = deps.Task || Task;
    this.docker = deps.docker || new DockerService();
    this.fleet = deps.fleet || new FleetExec();
  }

  hostFromRow(row) {
    return {
      id: String(row.pin_worker_id || row.worker_id || '').trim(),
      hostname: String(row.worker_hostname || '').trim(),
    };
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  async mergeEnvSecrets(projectId, environment, env) {
    const merged = { ...(env || {}) };
    try {
      const { proxy } = require('../../../shared/conductorProxy');
      const res = await proxy({
        service: 'secrets_manager',
        method: 'GET',
        path: `/api/v1/secrets/values?environment=${encodeURIComponent(environment || 'prod')}`,
        projectId,
        timeout: 15000,
      });
      const values = res.data?.values || {};
      for (const [k, v] of Object.entries(values)) {
        if (merged[k] == null || merged[k] === '') merged[k] = v;
      }
    } catch (e) {
      console.warn('[compute] env secrets skipped:', e.message);
    }
    return merged;
  }

  assertName(name) {
    if (!name || !NAME_RE.test(String(name).trim())) {
      const e = new Error('Invalid name: 1–64 chars, letters, numbers, _, -');
      e.status = 400;
      throw e;
    }
  }

  async updateTask(id, projectId, body = {}) {
    const row = await this.getById(id, projectId);
    const patch = {};
    if (body.env && typeof body.env === 'object' && !Array.isArray(body.env)) {
      const env = { ...this.parseEnv(row), ...body.env };
      delete env.AEREKOS_ADOPTED;
      patch.env = JSON.stringify(env);
    }
    if (body.pin_worker_id != null) patch.pin_worker_id = String(body.pin_worker_id);
    if (Array.isArray(body.volumes)) patch.volumes = JSON.stringify(body.volumes);
    if (body.port_bindings && typeof body.port_bindings === 'object') {
      patch.port_bindings = JSON.stringify(toDockerPortBindings(body.port_bindings) || body.port_bindings);
    }
    if (!Object.keys(patch).length) return row;
    await this.Task.update(id, patch);
    return this.getById(id, projectId);
  }

  async createTask(body) {
    this.assertProjectId(body.project_id);
    try {
      const { assertQuota } = require('../../../shared/quotaGate');
      await assertQuota(body.project_id, 'compute_tasks');
    } catch (e) {
      if (e.status === 429) throw e;
    }
    this.assertName(body.name);
    if (!body.image || typeof body.image !== 'string') {
      const e = new Error('image is required');
      e.status = 400;
      throw e;
    }
    const runMode = body.run_mode === 'oneshot' ? 'oneshot' : 'service';

    const environment = String(body.environment || body.env_name || 'prod').trim() || 'prod';
    const existing = await this.Task.findAll({
      where: { name: body.name, project_id: body.project_id, environment }
    });
    if (existing.length) {
      const e = new Error('A task with this name already exists in this environment');
      e.status = 409;
      throw e;
    }

    const command = Array.isArray(body.command) ? body.command : null;
    const env = body.env && typeof body.env === 'object' && !Array.isArray(body.env) ? body.env : {};
    const portMap = toDockerPortBindings(body.port_bindings || body.ports);
    const volumes = Array.isArray(body.volumes) ? body.volumes : [];
    const binds = volumeBinds(volumes, body.project_id, environment);
    const resourceLimits = mergeRuntimeLimits(
      body,
      body.resource_limits && typeof body.resource_limits === 'object' ? body.resource_limits : {},
    );
    const requestGb = Number(resourceLimits.ram_gb || body.ram_gb || 0.5);
    const host = await this.fleet.resolve({
      pin: body.pin_worker_id || body.worker_id || body.pin,
      requestGb,
      place: body.place,
    });
    if (body.database_url) env.DATABASE_URL = body.database_url;
    const runtimeEnv = await this.mergeEnvSecrets(body.project_id, environment, env);
    const workerId = String(host.id || body.worker_id || process.env.WORKER_ID || process.env.AEREKOS_WORKER_ID || '');
    const workerHostname = String(host.hostname || body.worker_hostname || process.env.WORKER_HOSTNAME || process.env.HOSTNAME || '');

    const row = await this.Task.create({
      name: String(body.name).trim(),
      project_id: body.project_id,
      image: String(body.image).trim(),
      command: command ? JSON.stringify(command) : '[]',
      env: JSON.stringify(env),
      port_bindings: JSON.stringify(portMap || body.port_bindings || {}),
      volumes: JSON.stringify(volumes),
      run_mode: runMode,
      status: 'pending',
      container_id: '',
      exit_code: -1,
      error_message: '',
      desired: body.desired == null ? 1 : Number(body.desired),
      balancer_id: String(body.balancer_id || ''),
      database_name: String(body.database_name || ''),
      pin_worker_id: String(body.pin_worker_id || body.worker_id || body.pin || (body.place === 'any' ? host.id : '') || ''),
      worker_id: workerId,
      worker_hostname: workerHostname,
      environment,
      network: String(body.network || process.env.COMPUTE_DOCKER_NETWORK || ''),
      arn: `arn:aerekos:${body.project_id}:compute:task/${String(body.name).trim()}`,
      replica_ids: '[]',
      resource_limits: JSON.stringify(resourceLimits),
    });

    const containerName = this._containerName(row.id, body.name);
    const labels = {
      'aerekos.project_id': body.project_id,
      'aerekos.task_id': row.id,
      'aerekos.task_name': body.name,
      'aerekos.environment': environment,
    };

    try {
      const remoteHost = !this.fleet.isLocal(host);
      if (process.env.SKIP_DOCKER !== '1' && process.env.SKIP_DOCKER !== 'true') {
        await this.ensureImage(host, String(body.image).trim());
      }
      if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true') {
        await this.Task.update(row.id, {
          status: 'running',
          container_id: 'mock-container-id',
          error_message: ''
        });
        return this.getById(row.id, body.project_id);
      }
      const spec = withRuntimeSpec({
        name: containerName,
        image: String(body.image).trim(),
        command: command || undefined,
        env: Object.keys(runtimeEnv).length ? runtimeEnv : undefined,
        portBindings: portMap,
        labels,
        network: process.env.COMPUTE_DOCKER_NETWORK || body.network || undefined,
        binds,
      }, resourceLimits);
      const remote = await this.fleet.create(host, spec);
      const result = remote || await this.docker.createAndStart(spec);
      await this.Task.update(row.id, {
        status: 'running',
        container_id: result.id,
        error_message: '',
        worker_id: workerId,
        worker_hostname: workerHostname,
      });
    } catch (e) {
      const msg = e.message || String(e);
      await this.Task.update(row.id, {
        status: 'failed',
        error_message: msg
      });
      const err = new Error(msg);
      err.status = e.status || 500;
      err.code = e.code;
      throw err;
    }

    return this.getById(row.id, body.project_id);
  }

  isAdopted(row) {
    try {
      const env = JSON.parse(row.env || '{}');
      return env.AEREKOS_ADOPTED === '1' || env.AEREKOS_ADOPTED === 1;
    } catch {
      return false;
    }
  }

  isMissingContainer(err) {
    const code = err?.statusCode || err?.status;
    return code === 404 || /no such container/i.test(String(err?.message || ''));
  }

  async dockerHostName() {
    if (typeof this.docker.hostName === 'function') {
      return this.docker.hostName();
    }
    return String(process.env.WORKER_HOSTNAME || '').trim();
  }

  async adoptTask(body) {
    this.assertProjectId(body.project_id);
    this.assertName(body.name);
    const ref = String(body.container_id || body.container || body.container_name || '').trim();
    if (!ref) {
      const e = new Error('container_id or container_name is required');
      e.status = 400;
      throw e;
    }
    const environment = String(body.environment || 'prod').trim() || 'prod';
    const existing = await this.Task.findAll({
      where: { name: String(body.name).trim(), project_id: body.project_id, environment },
    });
    if (existing.length) {
      return this.getById(existing[0].id, body.project_id);
    }
    const host = await this.fleet.resolve({
      pin: body.worker_id || body.pin_worker_id || body.pin,
      skipCapacity: true,
    });
    let info;
    try {
      const remote = await this.fleet.inspect(host, ref);
      if (remote?.inspect) info = remote.inspect;
      else if (remote?.id && remote.image) {
        info = {
          Id: remote.id,
          Config: { Image: remote.image, Env: remote.env || [] },
          State: { Running: remote.running, ExitCode: remote.exitCode },
          Mounts: remote.mounts || [],
          NetworkSettings: { Ports: remote.ports || {} },
          HostConfig: { PortBindings: remote.ports || {} },
        };
      } else if (this.fleet.isLocal(host)) {
        info = await this.docker.inspect(ref);
      } else {
        throw Object.assign(new Error('container not found on target worker'), { status: 404 });
      }
    } catch (e) {
      const err = new Error(e.message || 'container not found');
      err.status = 404;
      throw err;
    }
    const env = { ...(body.env && typeof body.env === 'object' ? body.env : {}), AEREKOS_ADOPTED: '1' };
    const resourceLimits = mergeRuntimeLimits(
      body,
      body.resource_limits && typeof body.resource_limits === 'object' ? body.resource_limits : {},
    );
    if (info.HostConfig?.Runtime && !resourceLimits.runtime) {
      resourceLimits.runtime = String(info.HostConfig.Runtime);
    }
    if (info.HostConfig?.ShmSize && resourceLimits.shm_size == null) {
      resourceLimits.shm_size = info.HostConfig.ShmSize;
    }
    const running = !!(info.State && info.State.Running);
    let portBindings = body.port_bindings || {};
    try {
      const pubs = info.NetworkSettings?.Ports || info.HostConfig?.PortBindings || {};
      if (pubs && typeof pubs === 'object' && !Object.keys(portBindings).length) portBindings = pubs;
    } catch (_) { /* ignore */ }
    const binds = (info.Mounts || []).map((m) => {
      if (m.Name && m.Destination) return `${m.Name}:${m.Destination}`;
      if (m.Source && m.Destination) return `${m.Source}:${m.Destination}`;
      return null;
    }).filter(Boolean);
    const dockerHost = await this.dockerHostName();
    const row = await this.Task.create({
      name: String(body.name).trim(),
      project_id: body.project_id,
      image: String(info.Config?.Image || body.image || '').trim() || 'unknown',
      command: '[]',
      env: JSON.stringify(env),
      port_bindings: JSON.stringify(portBindings),
      volumes: JSON.stringify(body.volumes || binds),
      run_mode: 'service',
      status: running ? 'running' : 'stopped',
      container_id: info.Id,
      exit_code: -1,
      error_message: '',
      desired: 1,
      balancer_id: '',
      database_name: '',
      pin_worker_id: String(body.pin_worker_id || host.id || ''),
      worker_id: String(host.id || body.worker_id || process.env.WORKER_ID || ''),
      worker_hostname: String(host.hostname || body.worker_hostname || process.env.WORKER_HOSTNAME || dockerHost || ''),
      environment,
      network: '',
      arn: `arn:aerekos:${body.project_id}:compute:task/${String(body.name).trim()}`,
      replica_ids: '[]',
      resource_limits: JSON.stringify(resourceLimits),
    });
    return this.getById(row.id, body.project_id);
  }

  _containerName(taskId, taskName) {
    const safe = String(taskName).replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 40);
    const short = String(taskId).replace(/-/g, '').slice(0, 12);
    return `aer-cmp-${short}-${safe}`.toLowerCase().slice(0, 120);
  }

  async list(projectId, environment) {
    this.assertProjectId(projectId);
    const where = { project_id: projectId };
    if (environment) where.environment = String(environment);
    return this.Task.findAll({ where });
  }

  async listRunning() {
    const rows = await this.Task.findAll({ where: { status: 'running' } });
    return (rows || []).filter((r) => r.container_id);
  }

  parseEnv(row) {
    try {
      return row.env ? JSON.parse(row.env) : {};
    } catch {
      return {};
    }
  }

  async getById(id, projectId) {
    const where = { id };
    if (projectId && String(projectId).trim()) where.project_id = projectId;
    const rows = await this.Task.findAll({ where });
    if (!rows.length) {
      const e = new Error('Task not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async findExistingContainer(row) {
    const name = this._containerName(row.id, row.name);
    if (typeof this.docker.inspectByName === 'function') {
      const byName = await this.docker.inspectByName(name);
      if (byName) return byName;
    }
    try {
      return await this.docker.inspect(name);
    } catch (e) {
      if (!this.isMissingContainer(e)) throw e;
    }
    return null;
  }

  async bindToInspect(id, projectId, info) {
    const running = !!(info.State && info.State.Running);
    const patch = {
      container_id: info.Id,
      status: running ? 'running' : 'stopped',
      error_message: '',
    };
    if (info.State && typeof info.State.ExitCode === 'number') patch.exit_code = info.State.ExitCode;
    const hostName = await this.dockerHostName();
    if (hostName) patch.worker_hostname = hostName;
    await this.Task.update(id, patch);
    return this.getById(id, projectId);
  }

  async recoverMissingContainer(row, projectId) {
    const existing = await this.findExistingContainer(row);
    if (!existing) return null;
    return this.bindToInspect(row.id, projectId, existing);
  }

  /**
   * Sync status from Docker inspect (when possible)
   */
  async inspectRow(row) {
    const host = this.hostFromRow(row);
    try {
      const remote = await this.fleet.inspect(host, row.container_id);
      if (remote?.inspect) return remote.inspect;
      if (remote?.id) {
        return {
          Id: remote.id,
          Config: { Image: remote.image, Env: remote.env || [] },
          State: { Running: remote.running, ExitCode: remote.exitCode },
          Mounts: remote.mounts || [],
          NetworkSettings: { Ports: remote.ports || {} },
          HostConfig: { PortBindings: remote.ports || {} },
        };
      }
    } catch (_) { /* stale hostname / empty worker id — use local sock */ }
    return this.docker.inspect(row.container_id);
  }

  async getByIdRefreshed(id, projectId) {
    const row = await this.getById(id, projectId);
    if (process.env.SKIP_DOCKER === '1' || !row.container_id || row.status === 'failed') {
      return row;
    }
    if (row.container_id === 'mock-container-id') {
      return row;
    }
    try {
      const info = await this.inspectRow(row);
      const running = info.State && info.State.Running;
      const exit = info.State && typeof info.State.ExitCode === 'number' ? info.State.ExitCode : null;
      let status = row.status;
      if (running) {
        status = 'running';
      } else if (row.run_mode === 'oneshot' && !running) {
        status = exit === 0 ? 'stopped' : 'failed';
      } else {
        status = 'stopped';
      }
      const patch = {};
      if (status !== row.status || exit !== row.exit_code) {
        patch.status = status;
        patch.exit_code = exit;
      }
      let existingPorts = {};
      try { existingPorts = row.port_bindings ? JSON.parse(row.port_bindings) : {}; } catch { existingPorts = {}; }
      if (this.isAdopted(row) && !Object.keys(existingPorts || {}).length) {
        const pubs = info.NetworkSettings?.Ports || info.HostConfig?.PortBindings || {};
        if (pubs && typeof pubs === 'object' && Object.keys(pubs).length) {
          patch.port_bindings = JSON.stringify(pubs);
        }
      }
      if (!this.fleet || this.fleet.isLocal(this.hostFromRow(row))) {
        const host = await this.dockerHostName();
        if (host && host !== row.worker_hostname) patch.worker_hostname = host;
      }
      if (Object.keys(patch).length) {
        await this.Task.update(row.id, patch);
        return this.getById(id, projectId);
      }
    } catch (e) {
      if (e.statusCode === 404 || this.isMissingContainer(e)) {
        const rebound = await this.recoverMissingContainer(row, projectId);
        if (rebound) return rebound;
        await this.Task.update(row.id, { status: 'stopped', error_message: 'container not found' });
        return this.getById(id, projectId);
      }
    }
    return row;
  }

  async stopTask(id, projectId) {
    const row = await this.getById(id, projectId);
    if (!row.container_id) {
      return row;
    }
    if (row.container_id === 'mock-container-id' || process.env.SKIP_DOCKER === '1') {
      await this.Task.update(id, { status: 'stopped' });
      return this.getById(id, projectId);
    }
    try {
      const remote = await this.fleet.stop(this.hostFromRow(row), row.container_id);
      if (!remote) await this.docker.stopContainer(row.container_id);
      await this.Task.update(id, { status: 'stopped' });
    } catch (e) {
      const err = new Error(e.message);
      err.status = 500;
      throw err;
    }
    return this.getById(id, projectId);
  }

  async startTask(id, projectId) {
    const row = await this.getById(id, projectId);
    if (!row.container_id || row.container_id === 'mock-container-id' || process.env.SKIP_DOCKER === '1') {
      await this.Task.update(id, { status: 'running', error_message: '' });
      return this.getById(id, projectId);
    }
    try {
      const remote = await this.fleet.start(this.hostFromRow(row), row.container_id);
      if (!remote) await this.docker.startContainer(row.container_id);
      await this.Task.update(id, { status: 'running', error_message: '' });
      return this.getById(id, projectId);
    } catch (e) {
      if (this.isMissingContainer(e) && !this.isAdopted(row)) {
        const rebound = await this.recoverMissingContainer(row, projectId);
        if (rebound) {
          if (rebound.status !== 'running' && rebound.container_id) {
            await this.docker.startContainer(rebound.container_id);
            await this.Task.update(id, { status: 'running', error_message: '' });
            return this.getById(id, projectId);
          }
          return rebound;
        }
        try {
          return await this.replaceImage(id, projectId, row.image);
        } catch (createErr) {
          const again = await this.recoverMissingContainer(row, projectId);
          if (again) return again;
          throw createErr;
        }
      }
      const err = new Error(e.message);
      err.status = e.status || e.statusCode || 500;
      throw err;
    }
  }

  async restartTask(id, projectId) {
    const row = await this.getById(id, projectId);
    if (!row.container_id || row.container_id === 'mock-container-id' || process.env.SKIP_DOCKER === '1') {
      await this.Task.update(id, { status: 'running', error_message: '' });
      return this.getById(id, projectId);
    }
    try {
      const host = this.hostFromRow(row);
      const remoteStop = await this.fleet.stop(host, row.container_id);
      if (remoteStop) {
        await this.fleet.start(host, row.container_id);
      } else {
        await this.docker.restartContainer(row.container_id);
      }
      await this.Task.update(id, { status: 'running', error_message: '' });
      return this.getById(id, projectId);
    } catch (e) {
      if (this.isMissingContainer(e) && !this.isAdopted(row)) {
        const rebound = await this.recoverMissingContainer(row, projectId);
        if (rebound) return rebound;
        return this.replaceImage(id, projectId, row.image);
      }
      const err = new Error(e.message);
      err.status = e.status || e.statusCode || 500;
      throw err;
    }
  }

  /**
   * Replace the image on an existing task (Cloud Run revision of the same service).
   * Refuses adopted containers unless force=true.
   */
  async replaceImage(id, projectId, image, { force = false, pin_worker_id } = {}) {
    const row = await this.getById(id, projectId);
    if (this.isAdopted(row) && !force) {
      const e = new Error('refusing to rebuild an adopted container');
      e.status = 409;
      e.code = 'ADOPTED';
      throw e;
    }
    const nextImage = String(image || '').trim();
    if (!nextImage) {
      const e = new Error('image is required');
      e.status = 400;
      throw e;
    }
    if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true') {
      await this.Task.update(id, { image: nextImage, status: 'running', error_message: '' });
      return this.getById(id, projectId);
    }
    const storedEnv = this.parseEnv(row);
    if (force) delete storedEnv.AEREKOS_ADOPTED;
    let command = [];
    let portMap = {};
    try { command = row.command ? JSON.parse(row.command) : []; } catch { command = []; }
    try { portMap = row.port_bindings ? JSON.parse(row.port_bindings) : {}; } catch { portMap = {}; }
    const volumes = parseJson(row.volumes, []);
    const binds = volumeBinds(volumes, projectId, row.environment || 'prod');
    const resourceLimits = parseJson(row.resource_limits, {});
    const pin = pin_worker_id != null && String(pin_worker_id).trim()
      ? String(pin_worker_id).trim()
      : (row.pin_worker_id || row.worker_id);
    if (pin_worker_id != null && String(pin_worker_id).trim() && String(pin) !== String(row.pin_worker_id || '')) {
      await this.Task.update(id, { pin_worker_id: pin });
    }
    const host = await this.fleet.resolve({
      pin,
      requestGb: Number(resourceLimits.ram_gb || 0.5),
    });
    const env = await this.mergeEnvSecrets(projectId, row.environment || 'prod', storedEnv);
    if (process.env.SKIP_DOCKER !== '1') await this.ensureImage(host, nextImage);
    if (row.container_id && row.container_id !== 'mock-container-id' && (!this.isAdopted(row) || force)) {
      try {
        const gone = await this.fleet.remove(host, row.container_id);
        if (!gone) await this.docker.removeContainer(row.container_id, { force: true });
      } catch (_) { /* */ }
    }
    const spec = withRuntimeSpec({
      name: this._containerName(row.id, row.name),
      image: nextImage,
      command: command.length ? command : undefined,
      env: Object.keys(env).length ? env : undefined,
      portBindings: Object.keys(portMap).length ? portMap : undefined,
      labels: {
        'aerekos.project_id': projectId,
        'aerekos.task_id': row.id,
        'aerekos.task_name': row.name,
      },
      network: row.network || process.env.COMPUTE_DOCKER_NETWORK || undefined,
      binds: binds.length ? binds : undefined,
    }, resourceLimits);
    const remote = await this.fleet.create(host, spec);
    const result = remote || await this.docker.createAndStart(spec);
    await this.Task.update(id, {
      image: nextImage,
      container_id: result.id,
      status: 'running',
      error_message: '',
      env: JSON.stringify(storedEnv),
    });
    return this.getById(id, projectId);
  }

  async health(id, projectId) {
    const row = await this.getById(id, projectId);
    let running = row.status === 'running';
    if (row.container_id && row.container_id !== 'mock-container-id' && process.env.SKIP_DOCKER !== '1') {
      try {
        const inspect = await this.inspectRow(row);
        running = !!inspect?.State?.Running;
        if (!running && row.status === 'running') {
          await this.Task.update(id, { status: 'failed', error_message: 'container not running' });
        }
      } catch (e) {
        running = false;
      }
    }
    return { task_id: id, running, status: running ? 'running' : 'unhealthy' };
  }

  async deleteTask(id, projectId) {
    const row = await this.getById(id, projectId);
    if (
      row.container_id
      && row.container_id !== 'mock-container-id'
      && process.env.SKIP_DOCKER !== '1'
      && !this.isAdopted(row)
    ) {
      try {
        const gone = await this.fleet.remove(this.hostFromRow(row), row.container_id);
        if (!gone) await this.docker.removeContainer(row.container_id, { force: true });
      } catch (e) {
        /* best effort */
      }
    }
    try {
      const { conductorBase, authHeaders } = require('../../../shared/conductorProxy');
      const axios = require('axios');
      const listed = await axios.get(`${conductorBase()}/api/services/domain_manager/api/v1/dns/hostnames`, {
        headers: authHeaders(projectId),
        params: { project_id: projectId },
        timeout: 15000,
        validateStatus: () => true,
      });
      const rows = (listed.data?.hostnames || []).filter((h) => String(h.target_id) === String(id));
      for (const h of rows) {
        await axios.post(`${conductorBase()}/api/edge/unbind`, { project_id: projectId, id: h.id }, {
          headers: authHeaders(projectId), timeout: 15000, validateStatus: () => true,
        });
      }
    } catch (_) { /* unbind is best-effort; delete still proceeds */ }
    await this.Task.delete(id);
    return { deleted: true, id };
  }

  async stats(id, projectId) {
    const row = await this.getById(id, projectId);
    const base = {
      task_id: id,
      running: row.status === 'running',
      cpu_percent: null,
      memory_bytes: null,
    };
    if (!row.container_id || process.env.SKIP_DOCKER === '1' || row.container_id === 'mock-container-id') {
      return { ...base, cpu_percent: 0, memory_bytes: 0 };
    }
    try {
      const remote = await this.fleet.stats(this.hostFromRow(row), row.container_id);
      const snap = remote || await this.docker.stats(row.container_id);
      const memory = snap.memory_bytes != null
        ? Number(snap.memory_bytes)
        : (snap.mem_mb != null ? Number(snap.mem_mb) * 1024 * 1024 : NaN);
      return {
        ...base,
        running: true,
        cpu_percent: Number(snap.cpu_percent),
        memory_bytes: memory,
      };
    } catch (e) {
      if (e.status === 404 || e.statusCode === 404 || /no such container/i.test(e.message || '')) {
        return { ...base, running: false, error: 'container not found' };
      }
      const err = new Error(e.message || 'stats failed');
      err.status = e.status || e.statusCode || 502;
      throw err;
    }
  }

  async logs(id, projectId, tail = 200) {
    const row = await this.getById(id, projectId);
    if (!row.container_id || process.env.SKIP_DOCKER === '1' || row.container_id === 'mock-container-id') {
      return { logs: row.error_message || '(no container logs)' };
    }
    try {
      const remote = await this.fleet.logs(this.hostFromRow(row), row.container_id, tail);
      if (remote) return remote;
    } catch (_) { /* local docker.sock */ }
    const text = await this.docker.logs(row.container_id, { tail });
    return { logs: text };
  }

  async ensureImage(host, image) {
    const ref = String(image || '').trim();
    if (!ref) return;
    if (this.fleet.isLocal(host)) {
      try {
        await this.docker.assertImageLocal(ref);
      } catch (e) {
        if (e.code === 'IMAGE_NOT_LOCAL') await this.docker.pullImage(ref);
        else throw e;
      }
      return;
    }
    try {
      await this.fleet.pull(host, ref);
      return;
    } catch (e) {
      const registry = String(process.env.INTERNAL_REGISTRY || '').replace(/\/$/, '').trim();
      const hasHost = ref.includes('/') && /^[^/]+:\d+|^[^/]+\.[^/]+/.test(ref);
      if (!registry || hasHost) throw e;
      await this.fleet.pull(host, `${registry}/${ref}`);
    }
  }

  isVllmImage(image) {
    return /vllm/i.test(String(image || ''));
  }

  async scaleTask(id, projectId, desired, body = {}) {
    const row = await this.getById(id, projectId);
    const n = Math.max(0, parseInt(desired, 10));
    if (Number.isNaN(n)) {
      const e = new Error('desired must be an integer >= 0');
      e.status = 400;
      throw e;
    }
    if (n > 1 && this.isVllmImage(row.image) && body.allow_vllm_clone !== true) {
      const e = new Error('refusing to clone a vLLM GPU job — pin and scale explicitly with allow_vllm_clone');
      e.status = 409;
      e.code = 'NO_VLLM_CLONE';
      throw e;
    }
    if (n > 1 && !row.balancer_id && !body.balancer_id) {
      const e = new Error('N>1 requires a load balancer (balancer_id)');
      e.status = 409;
      e.code = 'LB_REQUIRED';
      throw e;
    }
    await this.Task.update(id, {
      desired: n,
      balancer_id: body.balancer_id || row.balancer_id || '',
    });
    if (n === 0) {
      await this.reconcileReplicas(row, 0);
      return this.stopTask(id, projectId);
    }
    if (n >= 1 && (row.status === 'stopped' || row.status === 'failed')) {
      if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true') {
        await this.Task.update(id, { status: 'running' });
      } else {
        await this.startTask(id, projectId);
      }
    }
    const fresh = await this.getById(id, projectId);
    await this.reconcileReplicas(fresh, n);
    return this.getById(id, projectId);
  }

  parseReplicaIds(row) {
    try {
      const ids = JSON.parse(row.replica_ids || '[]');
      return Array.isArray(ids) ? ids.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  async reconcileReplicas(row, desired) {
    if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true') return;
    const extras = this.parseReplicaIds(row);
    const want = Math.max(0, desired - 1);
    const volumes = parseJson(row.volumes, []);
    if (want > extras.length && volumes.length) {
      const e = new Error('refusing to spread a stateful task; pin and keep desired=1');
      e.status = 409;
      e.code = 'STATEFUL_NO_SPREAD';
      throw e;
    }
    const host = await this.fleet.resolve({
      pin: row.pin_worker_id || row.worker_id,
      requestGb: 0.5,
    });
    while (extras.length > want) {
      const cid = extras.pop();
      try {
        const remote = await this.fleet.remove(host, cid);
        if (!remote) await this.docker.removeContainer(cid, { force: true });
      } catch (_) { /* */ }
    }
    const env = await this.mergeEnvSecrets(row.project_id, row.environment || 'prod', this.parseEnv(row));
    let portMap = {};
    try { portMap = row.port_bindings ? JSON.parse(row.port_bindings) : {}; } catch { portMap = {}; }
    while (extras.length < want) {
      const idx = extras.length + 2;
      const spec = withRuntimeSpec({
        name: `${this._containerName(row.id, row.name)}-r${idx}`,
        image: row.image,
        env: Object.keys(env).length ? env : undefined,
        portBindings: undefined,
        labels: {
          'aerekos.project_id': row.project_id,
          'aerekos.task_id': row.id,
          'aerekos.replica': String(idx),
        },
      }, parseJson(row.resource_limits, {}));
      await this.ensureImage(host, row.image);
      const remote = await this.fleet.create(host, spec);
      const result = remote || await this.docker.createAndStart(spec);
      extras.push(result.id || result.Id);
    }
    await this.Task.update(row.id, { replica_ids: JSON.stringify(extras) });
  }

  async attachDatabase(id, projectId, databaseName) {
    const name = String(databaseName || '').trim();
    if (!name) {
      const e = new Error('database_name required');
      e.status = 400;
      throw e;
    }
    const row = await this.getById(id, projectId);
    let env = {};
    try {
      env = row.env ? JSON.parse(row.env) : {};
    } catch {
      env = {};
    }
    env.DATABASE_URL = env.DATABASE_URL || `postgres://app@${name}:5432/${name}`;
    await this.Task.update(id, {
      database_name: name,
      env: JSON.stringify(env),
    });
    return this.getById(id, projectId);
  }
}

module.exports = { TaskService, toDockerPortBindings };
