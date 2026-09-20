const Docker = require('dockerode');
const { applyGpuHostConfig } = require('../../shared/dockerGpuHostConfig');

/**
 * Host-level Docker operations for the worker agent (all containers on device).
 */
class ContainerHostService {
  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async listContainers() {
    const rows = await this.docker.listContainers({ all: true });
    const running = rows.filter((c) => c.State === 'running').slice(0, 24);
    const statsById = {};
    await Promise.all(running.map(async (c) => {
      try {
        const raw = await this.docker.getContainer(c.Id).stats({ stream: false });
        const cpuDelta = Number(raw?.cpu_stats?.cpu_usage?.total_usage || 0) - Number(raw?.precpu_stats?.cpu_usage?.total_usage || 0);
        const sysDelta = Number(raw?.cpu_stats?.system_cpu_usage || 0) - Number(raw?.precpu_stats?.system_cpu_usage || 0);
        const ncpu = (raw?.cpu_stats?.cpu_usage?.percpu_usage || []).length || 1;
        const cpuPct = sysDelta > 0 ? (cpuDelta / sysDelta) * ncpu * 100 : 0;
        statsById[c.Id] = {
          cpu_percent: Math.round(cpuPct * 10) / 10,
          mem_mb: Math.round(Number(raw?.memory_stats?.usage || 0) / 1024 / 1024),
        };
      } catch { /* stats optional */ }
    }));
    return rows.map((c) => ({
      id: c.Id,
      name: (c.Names?.[0] || '').replace(/^\//, ''),
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
      ports: c.Ports || [],
      cpu_percent: statsById[c.Id]?.cpu_percent,
      mem_mb: statsById[c.Id]?.mem_mb,
    }));
  }

  async inspect(idOrName) {
    const ref = String(idOrName || '').replace(/^\//, '').trim();
    if (!ref) {
      const e = new Error('container id or name is required');
      e.status = 400;
      throw e;
    }
    try {
      return await this.docker.getContainer(ref).inspect();
    } catch (e) {
      if (e.statusCode !== 404) throw e;
      const rows = await this.docker.listContainers({ all: true });
      const hit = rows.find((c) => (c.Names || []).some((n) => n.replace(/^\//, '') === ref));
      if (!hit) throw e;
      return this.docker.getContainer(hit.Id).inspect();
    }
  }

  async getContainer(id) {
    const info = await this.inspect(id);
    const binds = (info.Mounts || []).map((m) => {
      if (m.Name && m.Destination) return `${m.Name}:${m.Destination}`;
      if (m.Source && m.Destination) return `${m.Source}:${m.Destination}`;
      return null;
    }).filter(Boolean);
    return {
      id: info.Id,
      name: info.Name?.replace(/^\//, ''),
      image: info.Config?.Image,
      state: info.State?.Status,
      running: info.State?.Running,
      startedAt: info.State?.StartedAt,
      finishedAt: info.State?.FinishedAt,
      exitCode: info.State?.ExitCode,
      env: info.Config?.Env || [],
      mounts: info.Mounts || [],
      binds,
      ports: info.NetworkSettings?.Ports || info.HostConfig?.PortBindings || {},
      inspect: info,
    };
  }

  async ensureImage(image) {
    const ref = String(image || '').trim();
    if (!ref) {
      const e = new Error('image is required');
      e.status = 400;
      throw e;
    }
    try {
      await this.docker.getImage(ref).inspect();
      return { image: ref, pulled: false };
    } catch {
      await new Promise((resolve, reject) => {
        this.docker.pull(ref, (err, stream) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (e) => (e ? reject(e) : resolve()));
        });
      });
      return { image: ref, pulled: true };
    }
  }

  async createAndStart(p = {}) {
    const image = String(p.image || '').trim();
    if (!image) {
      const e = new Error('image is required');
      e.status = 400;
      throw e;
    }
    await this.ensureImage(image);
    const Env = p.env && typeof p.env === 'object' && !Array.isArray(p.env)
      ? Object.entries(p.env).map(([k, v]) => `${k}=${v}`)
      : Array.isArray(p.env) ? p.env : [];
    const Cmd = p.command && p.command.length ? p.command : undefined;
    const ExposedPorts = {};
    if (p.portBindings) {
      for (const k of Object.keys(p.portBindings)) ExposedPorts[k] = {};
    }
    const hostConfig = {
      RestartPolicy: { Name: p.restartPolicy || 'unless-stopped' },
      ExtraHosts: Array.isArray(p.extra_hosts) && p.extra_hosts.length
        ? p.extra_hosts
        : ['host.docker.internal:host-gateway'],
    };
    if (p.portBindings && Object.keys(p.portBindings).length) hostConfig.PortBindings = p.portBindings;
    if (Array.isArray(p.binds) && p.binds.length) hostConfig.Binds = p.binds;
    const limits = p.resource_limits || p.resourceLimits || {};
    if (limits.ram_gb) hostConfig.Memory = Math.floor(Number(limits.ram_gb) * 1024 * 1024 * 1024);
    if (limits.cpu_cores) hostConfig.NanoCpus = Math.floor(Number(limits.cpu_cores) * 1e9);
    applyGpuHostConfig(hostConfig, p);
    const createOpts = {
      name: p.name,
      Image: image,
      Cmd,
      Env,
      Labels: { 'aerekos.managed': 'true', ...(p.labels || {}) },
      HostConfig: hostConfig,
    };
    if (Object.keys(ExposedPorts).length) createOpts.ExposedPorts = ExposedPorts;
    if (p.network) {
      createOpts.NetworkingConfig = { EndpointsConfig: { [p.network]: {} } };
    }
    const container = await this.docker.createContainer(createOpts);
    await container.start();
    const inspect = await container.inspect();
    return { id: inspect.Id, name: p.name || inspect.Name };
  }

  async removeContainer(id, { force = true } = {}) {
    try {
      await this.docker.getContainer(id).remove({ force });
    } catch (e) {
      if (e.statusCode !== 404) throw e;
    }
  }

  async startContainer(id) {
    const container = this.docker.getContainer(id);
    await container.start();
    return this.getContainer(id);
  }

  async stopContainer(id) {
    const container = this.docker.getContainer(id);
    await container.stop({ t: 10 }).catch((e) => {
      if (!String(e.message || '').includes('is not running')) throw e;
    });
    return this.getContainer(id);
  }

  async getStats(id) {
    const info = await this.inspect(id);
    const raw = await this.docker.getContainer(info.Id).stats({ stream: false });
    const cpuDelta = Number(raw?.cpu_stats?.cpu_usage?.total_usage || 0) - Number(raw?.precpu_stats?.cpu_usage?.total_usage || 0);
    const sysDelta = Number(raw?.cpu_stats?.system_cpu_usage || 0) - Number(raw?.precpu_stats?.system_cpu_usage || 0);
    const ncpu = raw?.cpu_stats?.online_cpus || (raw?.cpu_stats?.cpu_usage?.percpu_usage || []).length || 1;
    const cpu = sysDelta > 0 ? (cpuDelta / sysDelta) * ncpu * 100 : 0;
    return {
      cpu_percent: Math.round(cpu * 100) / 100,
      memory_bytes: Number(raw?.memory_stats?.usage || 0),
    };
  }

  async getLogs(id, { tail = 200, since = 0 } = {}) {
    const container = this.docker.getContainer(id);
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      tail: Math.min(Math.max(Number(tail) || 200, 1), 5000),
      since: since ? Number(since) : 0,
      timestamps: true,
    });
    const buf = await streamToBuffer(stream);
    return buf.toString('utf8');
  }

  async execContainer(id, cmd, { tty = false } = {}) {
    const parts = Array.isArray(cmd) ? cmd : String(cmd || 'sh').split(/\s+/).filter(Boolean);
    if (!parts.length) parts.push('sh');
    const container = this.docker.getContainer(id);
    const exec = await container.exec({
      Cmd: parts,
      AttachStdout: true,
      AttachStderr: true,
      Tty: Boolean(tty),
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    const output = await streamToBuffer(stream);
    const inspect = await exec.inspect();
    return {
      output: output.toString('utf8'),
      exitCode: inspect.ExitCode,
    };
  }
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    if (typeof stream === 'string' || Buffer.isBuffer(stream)) {
      resolve(Buffer.isBuffer(stream) ? stream : Buffer.from(stream));
      return;
    }
    const chunks = [];
    const onData = (chunk) => {
      if (chunk.length > 8 && (chunk[0] === 1 || chunk[0] === 2)) {
        chunks.push(chunk.slice(8));
      } else {
        chunks.push(chunk);
      }
    };
    const onEnd = () => resolve(Buffer.concat(chunks));
    if (stream.on) {
      stream.on('data', onData);
      stream.on('end', onEnd);
      stream.on('error', reject);
      return;
    }
    reject(new Error('unsupported_log_stream'));
  });
}

module.exports = new ContainerHostService();
