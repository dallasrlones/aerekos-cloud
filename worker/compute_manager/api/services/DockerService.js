const Docker = require('dockerode');

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
    hostConfig.RestartPolicy = { Name: p.restartPolicy || 'unless-stopped' };

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

  async stats(containerId) {
    const c = this.docker.getContainer(containerId);
    const s = await c.stats({ stream: false });
    const cpuDelta = (s.cpu_stats?.cpu_usage?.total_usage || 0) - (s.precpu_stats?.cpu_usage?.total_usage || 0);
    const sysDelta = (s.cpu_stats?.system_cpu_usage || 0) - (s.precpu_stats?.system_cpu_usage || 0);
    const ncpu = s.cpu_stats?.online_cpus || s.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
    const cpu = sysDelta > 0 ? (cpuDelta / sysDelta) * ncpu * 100 : 0;
    const memory = s.memory_stats?.usage || 0;
    return { cpu_percent: Math.round(cpu * 100) / 100, memory_bytes: memory };
  }

  async logs(containerId, { tail = 200, since } = {}) {
    const c = this.docker.getContainer(containerId);
    const opts = { stdout: true, stderr: true, tail: Number(tail) || 200, timestamps: true };
    if (since) opts.since = since;
    const buf = await c.logs(opts);
    return Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
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
