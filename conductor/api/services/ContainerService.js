'use strict';

const axios = require('axios');
const WorkerService = require('./WorkerService');
const WorkerSocketService = require('./WorkerSocketService');

const SOCKET_TIMEOUT_MS = 15 * 1000;
const HTTP_TIMEOUT_MS = 8 * 1000;
const CREATE_TIMEOUT_MS = 180 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function agentPort() {
  const n = parseInt(process.env.WORKER_AGENT_PORT || '3001', 10);
  return Number.isFinite(n) && n > 0 ? n : 3001;
}

class ContainerService {
  async assertOnline(workerId) {
    const worker = await WorkerService.getWorker(workerId);
    if (!worker) throw httpError(404, 'Worker not found');
    return worker;
  }

  bases(worker) {
    const port = agentPort();
    const ip = String(worker.ip_address || '').trim();
    const hosts = [];
    if (ip) hosts.push(`http://${ip}:${port}`);
    hosts.push(`http://aerekos-cloud-worker:${port}`);
    hosts.push(`http://host.docker.internal:${port}`);
    return [...new Set(hosts)];
  }

  async http(worker, method, path, data, timeoutMs) {
    let last = null;
    for (const base of this.bases(worker)) {
      try {
        const res = await axios({
          method,
          url: `${base}${path}`,
          data,
          timeout: timeoutMs || HTTP_TIMEOUT_MS,
          validateStatus: () => true,
        });
        if (res.status >= 200 && res.status < 300) return res.data;
        last = httpError(res.status, res.data?.error || `HTTP ${res.status}`);
      } catch (err) {
        last = err;
      }
    }
    throw last || httpError(503, 'Worker container HTTP unreachable');
  }

  async socket(workerId, event, data = {}) {
    if (!WorkerSocketService.isWorkerConnected(workerId)) {
      throw httpError(503, 'Worker is offline');
    }
    const reply = await WorkerSocketService.requestFromWorker(
      workerId,
      event,
      data,
      `${event}:result`,
      SOCKET_TIMEOUT_MS
    );
    if (!reply || reply.ok === false) {
      throw httpError(reply?.status || 400, reply?.error || 'Worker container request failed');
    }
    return reply;
  }

  async via(workerId, httpFn, socketFn) {
    const worker = await this.assertOnline(workerId);
    try {
      return await httpFn(worker);
    } catch (httpErr) {
      try {
        return await socketFn();
      } catch (sockErr) {
        throw httpErr.status ? httpErr : sockErr;
      }
    }
  }

  async list(workerId) {
    return this.via(
      workerId,
      async (worker) => {
        const data = await this.http(worker, 'GET', '/api/containers');
        return { containers: data.containers || [] };
      },
      async () => {
        const reply = await this.socket(workerId, 'containers:list');
        return { containers: reply.containers || [] };
      },
    );
  }

  async start(workerId, containerId) {
    return this.via(
      workerId,
      async (worker) => this.http(worker, 'POST', `/api/containers/${containerId}/start`),
      async () => {
        const reply = await this.socket(workerId, 'containers:start', { containerId });
        return { container: reply.container };
      },
    );
  }

  async stop(workerId, containerId) {
    return this.via(
      workerId,
      async (worker) => this.http(worker, 'POST', `/api/containers/${containerId}/stop`),
      async () => {
        const reply = await this.socket(workerId, 'containers:stop', { containerId });
        return { container: reply.container };
      },
    );
  }

  async logs(workerId, containerId, tail) {
    const q = tail != null ? `?tail=${encodeURIComponent(tail)}` : '';
    return this.via(
      workerId,
      async (worker) => {
        const data = await this.http(worker, 'GET', `/api/containers/${containerId}/logs${q}`);
        return { logs: data.logs || '' };
      },
      async () => {
        const reply = await this.socket(workerId, 'containers:logs', { containerId, tail });
        return { logs: reply.logs || '' };
      },
    );
  }

  async stats(workerId, containerId) {
    return this.via(
      workerId,
      async (worker) => {
        const data = await this.http(worker, 'GET', `/api/containers/${encodeURIComponent(containerId)}/stats`);
        return { stats: data.stats || data };
      },
      async () => {
        const reply = await this.socket(workerId, 'containers:stats', { containerId });
        return { stats: reply.stats };
      },
    );
  }

  async inspect(workerId, containerId) {
    return this.via(
      workerId,
      async (worker) => {
        const data = await this.http(worker, 'GET', `/api/containers/${encodeURIComponent(containerId)}`);
        return { container: data.container || data };
      },
      async () => {
        const reply = await this.socket(workerId, 'containers:inspect', { containerId });
        return { container: reply.container };
      },
    );
  }

  async pull(workerId, image) {
    const worker = await this.assertOnline(workerId);
    try {
      const data = await this.http(worker, 'POST', '/api/containers/pull', { image }, CREATE_TIMEOUT_MS);
      return { pulled: data.pulled || image };
    } catch (httpErr) {
      try {
        const reply = await this.socket(workerId, 'containers:pull', { image });
        return { pulled: reply.pulled || image };
      } catch (sockErr) {
        throw httpErr.status ? httpErr : sockErr;
      }
    }
  }

  async create(workerId, spec) {
    const worker = await this.assertOnline(workerId);
    try {
      const data = await this.http(worker, 'POST', '/api/containers', spec, CREATE_TIMEOUT_MS);
      return { container: data.container || data };
    } catch (httpErr) {
      try {
        const reply = await this.socket(workerId, 'containers:create', { spec });
        return { container: reply.container };
      } catch (sockErr) {
        throw httpErr.status ? httpErr : sockErr;
      }
    }
  }

  async remove(workerId, containerId, { force = true } = {}) {
    return this.via(
      workerId,
      async (worker) => this.http(worker, 'DELETE', `/api/containers/${encodeURIComponent(containerId)}?force=${force ? '1' : '0'}`),
      async () => {
        const reply = await this.socket(workerId, 'containers:remove', { containerId, force });
        return { deleted: true, ...(reply || {}) };
      },
    );
  }

  async exec(workerId, containerId, cmd, tty) {
    return this.via(
      workerId,
      async (worker) => this.http(worker, 'POST', `/api/containers/${containerId}/exec`, { cmd, tty }),
      async () => {
        const reply = await this.socket(workerId, 'containers:exec', { containerId, cmd, tty });
        return { output: reply.output || '', exitCode: reply.exitCode };
      },
    );
  }
}

module.exports = new ContainerService();
