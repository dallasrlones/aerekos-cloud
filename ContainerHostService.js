const Docker = require('dockerode');

/**
 * Host-level Docker operations for the worker agent (all containers on device).
 */
class ContainerHostService {
  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async listContainers() {
    const rows = await this.docker.listContainers({ all: true });
    return rows.map((c) => ({
      id: c.Id,
      name: (c.Names?.[0] || '').replace(/^\//, ''),
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
      ports: c.Ports || [],
    }));
  }

  async getContainer(id) {
    const container = this.docker.getContainer(id);
    const info = await container.inspect();
    return {
      id: info.Id,
      name: info.Name?.replace(/^\//, ''),
      image: info.Config?.Image,
      state: info.State?.Status,
      running: info.State?.Running,
      startedAt: info.State?.StartedAt,
      finishedAt: info.State?.FinishedAt,
      exitCode: info.State?.ExitCode,
    };
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
