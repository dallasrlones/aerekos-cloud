const Docker = require('dockerode');
const { applyGpuHostConfig } = require('../../../shared/dockerGpuHostConfig');

/**
 * Thin dockerode wrapper for user-defined task containers.
 * Pattern aligns with `worker/docker/ServiceManager.js` (image → create → start).
 */
class DockerService {
  /**
   * @param {{ socketPath?: string, docker?: import('dockerode') }} [opts]
   */
  constructor(opts = {}) {
    this.docker =
      opts.docker ||
      new Docker({
        socketPath: opts.socketPath || process.env.DOCKER_SOCKET || '/var/run/docker.sock'
      });
  }

  async assertImageLocal(image) {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch (e) {
      const err = new Error(
        `Docker image not found locally: ${image}. Pull the image on the worker first, or set up a registry.`
      );
      err.status = 400;
      err.code = 'IMAGE_NOT_LOCAL';
      throw err;
    }
  }

  /**
   * @param {object} p
   * @param {string} p.name - container name (unique on host)
   * @param {string} p.image
   * @param {string[]} [p.command]
   * @param {Record<string, string>} [p.env]
   * @param {Record<string, Array<{ HostPort: string }>>} [p.portBindings] — e.g. { '80/tcp': [{ HostPort: '18080' }] }
   * @param {Record<string, string>} [p.labels]
   * @param {string} [p.network] — optional network to attach
   * @param {string} [p.runtime] — docker runtime, e.g. `nvidia` (also via resource_limits.runtime)
   * @param {string|number} [p.shm_size] — /dev/shm size (`1g` or bytes)
   */
  async createAndStart(p) {
    const Env = p.env
      ? Object.entries(p.env).map(([k, v]) => `${k}=${v}`)
      : [];
    const Cmd = p.command && p.command.length ? p.command : undefined;

    const ExposedPorts = {};
    if (p.portBindings) {
      for (const k of Object.keys(p.portBindings)) {
        ExposedPorts[k] = {};
      }
    }

    const hostConfig = {};
    if (p.portBindings && Object.keys(p.portBindings).length) {
      hostConfig.PortBindings = p.portBindings;
    }
    if (Array.isArray(p.binds) && p.binds.length) {
      hostConfig.Binds = p.binds;
    }
    const limits = p.resource_limits || p.resourceLimits || {};
    if (limits.ram_gb) {
      hostConfig.Memory = Math.floor(Number(limits.ram_gb) * 1024 * 1024 * 1024);
    }
    if (limits.cpu_cores) {
      hostConfig.NanoCpus = Math.floor(Number(limits.cpu_cores) * 1e9);
    }
    hostConfig.RestartPolicy = { Name: p.restartPolicy || 'unless-stopped' };
    // Compose-style host alias; Linux Docker does not inject this unless asked.
    hostConfig.ExtraHosts = Array.isArray(p.extra_hosts) && p.extra_hosts.length
      ? p.extra_hosts
      : ['host.docker.internal:host-gateway'];
    applyGpuHostConfig(hostConfig, p);

    const createOpts = {
      name: p.name,
      Image: p.image,
      Cmd,
      Env,
      Labels: {
        'aerekos.managed': 'true',
        'aerekos.service': 'compute_manager',
        ...(p.labels || {})
      }
    };
    if (Object.keys(ExposedPorts).length) {
      createOpts.ExposedPorts = ExposedPorts;
    }
    if (Object.keys(hostConfig).length) {
      createOpts.HostConfig = hostConfig;
    }

    if (p.network) {
      createOpts.NetworkingConfig = {
        EndpointsConfig: { [p.network]: {} }
      };
    }

    const container = await this.docker.createContainer(createOpts);
    await container.start();
    const inspect = await container.inspect();
    return { id: inspect.Id, name: p.name };
  }

  async stopContainer(containerId, { t = 10 } = {}) {
    const c = this.docker.getContainer(containerId);
    try {
      await c.stop({ t });
    } catch (e) {
      if (e.statusCode === 304 || (e.json && e.json.message && e.json.message.includes('is not running'))) {
        return;
      }
      throw e;
    }
  }

  async removeContainer(containerId, { force = true } = {}) {
    const c = this.docker.getContainer(containerId);
    try {
      await c.remove({ force });
    } catch (e) {
      if (e.statusCode === 404) {
        return;
      }
      throw e;
    }
  }

  async inspect(containerId) {
    const c = this.docker.getContainer(containerId);
    return c.inspect();
  }

  async inspectByName(name) {
    const n = String(name || '').replace(/^\//, '');
    if (!n) return null;
    try {
      return await this.inspect(n);
    } catch (e) {
      if (e.statusCode === 404) return null;
      throw e;
    }
  }

  async listContainers() {
    const rows = await this.docker.listContainers({ all: true });
    return rows.map((c) => ({
      id: c.Id,
      name: (c.Names?.[0] || '').replace(/^\//, ''),
      image: c.Image,
      state: c.State,
      status: c.Status,
    }));
  }

  async restartContainer(containerId, { t = 10 } = {}) {
    const c = this.docker.getContainer(containerId);
    await c.restart({ t });
  }

  async startContainer(containerId) {
    const c = this.docker.getContainer(containerId);
    try {
      await c.start();
    } catch (e) {
      if (e.statusCode === 304 || (e.json && e.json.message && String(e.json.message).includes('already started'))) {
        return;
      }
      throw e;
    }
  }

  async pullImage(image) {
    const stream = await this.docker.pull(image);
    await new Promise((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
    });
  }

  async stats(containerId, { timeoutMs = 5000 } = {}) {
    const c = this.docker.getContainer(containerId);
    const started = Date.now();
    const once = () => {
      const remain = Math.max(400, timeoutMs - (Date.now() - started));
      return Promise.race([
        c.stats({ stream: false }),
        new Promise((_, reject) => {
          const t = setTimeout(() => {
            const e = new Error('docker stats timeout');
            e.status = 504;
            reject(e);
          }, remain);
          if (t.unref) t.unref();
        }),
      ]);
    };
    const parse = (s) => {
      const cpuDelta = (s.cpu_stats?.cpu_usage?.total_usage || 0) - (s.precpu_stats?.cpu_usage?.total_usage || 0);
      const sysDelta = (s.cpu_stats?.system_cpu_usage || 0) - (s.precpu_stats?.system_cpu_usage || 0);
      const ncpu = s.cpu_stats?.online_cpus || s.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
      const cpu = sysDelta > 0 ? (cpuDelta / sysDelta) * ncpu * 100 : 0;
      const usage = s.memory_stats?.usage || 0;
      const cache = s.memory_stats?.stats?.inactive_file
        || s.memory_stats?.stats?.cache
        || 0;
      return {
        cpu_percent: Math.round(cpu * 100) / 100,
        memory_bytes: Math.max(0, usage - cache),
        _ready: sysDelta > 0,
      };
    };
    let out = parse(await once());
    if (!out._ready) {
      await new Promise((r) => setTimeout(r, 250));
      out = parse(await once());
    }
    return { cpu_percent: out.cpu_percent, memory_bytes: out.memory_bytes };
  }

  async hostName() {
    try {
      const info = await this.docker.info();
      return String(info?.Name || '').trim();
    } catch {
      return '';
    }
  }

  stripLogMux(buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf || ''), 'utf8');
    if (b.length < 8 || (b[0] !== 1 && b[0] !== 2) || b[1] !== 0 || b[2] !== 0 || b[3] !== 0) {
      return b.toString('utf8');
    }
    const parts = [];
    let i = 0;
    while (i + 8 <= b.length) {
      const size = b.readUInt32BE(i + 4);
      const start = i + 8;
      const end = Math.min(start + size, b.length);
      if (end > start) parts.push(b.slice(start, end));
      i = end;
    }
    return Buffer.concat(parts).toString('utf8');
  }

  async logs(containerId, { tail = 200, since } = {}) {
    const c = this.docker.getContainer(containerId);
    const opts = { stdout: true, stderr: true, tail: Number(tail) || 200, timestamps: true };
    if (since) opts.since = since;
    const buf = await c.logs(opts);
    return this.stripLogMux(buf);
  }

  async buildImage({ contextDir, dockerfile = 'Dockerfile', tag }) {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const { stdout, stderr } = await execFileAsync(
      'docker',
      ['build', '-f', dockerfile, '-t', tag, '.'],
      { cwd: contextDir, timeout: 600000, maxBuffer: 8 * 1024 * 1024 }
    );
    return { tag, logs: `${stdout || ''}${stderr || ''}` };
  }

  async tagAndPush(localTag, registryHost) {
    const host = String(registryHost || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!host || !localTag) return null;
    const dest = `${host}/${localTag}`;
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    await execFileAsync('docker', ['tag', localTag, dest], { timeout: 30000 });
    const { stdout, stderr } = await execFileAsync('docker', ['push', dest], {
      timeout: 300000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { image: dest, logs: `${stdout || ''}${stderr || ''}` };
  }

  async loadImage(tarPath) {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const { stdout, stderr } = await execFileAsync('docker', ['load', '-i', tarPath], {
      timeout: 300000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { logs: `${stdout || ''}${stderr || ''}` };
  }
}

module.exports = { DockerService };
