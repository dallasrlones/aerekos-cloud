'use strict';

const axios = require('axios');
const { conductorBase, authHeaders } = require('../../../shared/conductorProxy');

function httpError(status, message, code) {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}

class FleetExec {
  constructor() {
    this.callerToken = '';
  }

  useToken(token) {
    this.callerToken = String(token || '').replace(/^Bearer\s+/i, '').trim();
    return this;
  }

  headers() {
    const tok = this.callerToken || process.env.CONDUCTOR_TOKEN || process.env.SERVICE_TOKEN || '';
    const base = authHeaders('');
    if (tok) base.Authorization = `Bearer ${tok}`;
    return base;
  }

  localId() {
    return String(process.env.WORKER_ID || process.env.AEREKOS_WORKER_ID || '').trim();
  }

  localHostname() {
    return String(process.env.WORKER_HOSTNAME || process.env.HOSTNAME || '').trim();
  }

  isLocal(host) {
    if (!host) return true;
    const hid = String(host.id || host.worker_id || '').trim();
    const hhn = String(host.hostname || host.display_name || '').trim();
    // No pin/worker id means this manager's docker.sock — a stale hostname
    // after compute_manager recreate must not send inspect/logs to /api/workers//...
    if (!hid) return true;
    const id = this.localId();
    const hn = this.localHostname();
    if (id && (hid === id)) return true;
    if (hn && (hhn === hn || host.display_name === hn)) return true;
    return false;
  }

  async hosts() {
    try {
      const res = await axios.get(`${conductorBase()}/api/fleet/capacity`, {
        headers: this.headers(),
        timeout: 10000,
        validateStatus: () => true,
      });
      return res.data?.hosts || [];
    } catch {
      return [];
    }
  }

  async resolve({ pin, requestGb, place, skipCapacity } = {}) {
    const hosts = await this.hosts();
    const local = { id: this.localId(), hostname: this.localHostname(), local: true };
    const want = String(pin || '').trim();
    if (want && !hosts.length) {
      return { id: want, hostname: '', local: this.isLocal({ id: want }) };
    }
    if (!hosts.length) return local;
    if (!want && place !== 'any') {
      const pinnedLocal = hosts.find((h) => this.isLocal(h));
      return pinnedLocal ? { ...pinnedLocal, local: true } : local;
    }
    if (want) {
      const host = hosts.find((h) => h.id === want || h.hostname === want);
      if (!host) throw httpError(404, 'worker not found');
      const skip = skipCapacity || process.env.SKIP_CAPACITY === '1' || process.env.SKIP_CAPACITY === 'true';
      if (!skip) {
        const check = await axios.post(`${conductorBase()}/api/fleet/capacity/can-fit`, {
          worker_id: host.id,
          request_gb: requestGb != null ? requestGb : 0.5,
        }, { headers: this.headers(), timeout: 8000, validateStatus: () => true });
        if (check.status === 409) {
          const e = httpError(409, check.data?.fit?.reason || 'INSUFFICIENT_MEMORY', 'INSUFFICIENT_MEMORY');
          throw e;
        }
      }
      return { ...host, local: this.isLocal(host) };
    }
    const online = hosts.filter((h) => h.status === 'online' || !h.status);
    const pool = online.length ? online : hosts;
    const prefer = pool.find((h) => this.isLocal(h));
    const ordered = prefer ? [prefer, ...pool.filter((h) => h !== prefer)] : pool;
    const skip = process.env.SKIP_CAPACITY === '1' || process.env.SKIP_CAPACITY === 'true';
    for (const host of ordered) {
      if (skip) return { ...host, local: this.isLocal(host) };
      try {
        const check = await axios.post(`${conductorBase()}/api/fleet/capacity/can-fit`, {
          worker_id: host.id,
          request_gb: requestGb != null ? requestGb : 0.5,
        }, { headers: this.headers(), timeout: 8000, validateStatus: () => true });
        if (check.status === 200 && check.data?.fit?.ok !== false) {
          return { ...host, local: this.isLocal(host) };
        }
      } catch {
        continue;
      }
    }
    throw httpError(409, 'no worker has enough memory', 'INSUFFICIENT_MEMORY');
  }

  async pull(host, image) {
    if (this.isLocal(host) || !host || !image) return null;
    const res = await axios.post(
      `${conductorBase()}/api/workers/${encodeURIComponent(host.id)}/containers/pull`,
      { image },
      { headers: this.headers(), timeout: 300000, validateStatus: () => true },
    );
    if (res.status >= 400) {
      throw httpError(res.status, res.data?.error?.message || res.data?.error || 'remote pull failed');
    }
    return res.data;
  }

  async create(host, spec) {
    if (this.isLocal(host)) return null;
    const res = await axios.post(
      `${conductorBase()}/api/workers/${encodeURIComponent(host.id)}/containers`,
      spec,
      { headers: this.headers(), timeout: 180000, validateStatus: () => true },
    );
    if (res.status >= 400) {
      throw httpError(res.status, res.data?.error?.message || res.data?.error || 'remote create failed');
    }
    return res.data?.container || res.data;
  }

  async inspect(host, containerId) {
    if (this.isLocal(host) || !host) return null;
    const res = await axios.get(
      `${conductorBase()}/api/workers/${encodeURIComponent(host.id)}/containers/${encodeURIComponent(containerId)}`,
      { headers: this.headers(), timeout: 20000, validateStatus: () => true },
    );
    if (res.status >= 400) {
      throw httpError(res.status, res.data?.error?.message || res.data?.error || 'remote inspect failed');
    }
    return res.data?.container || res.data;
  }

  async stop(host, containerId) {
    if (this.isLocal(host)) return null;
    const res = await axios.post(
      `${conductorBase()}/api/workers/${encodeURIComponent(host.id)}/containers/${encodeURIComponent(containerId)}/stop`,
      {},
      { headers: this.headers(), timeout: 20000, validateStatus: () => true },
    );
    if (res.status >= 400) throw httpError(res.status, res.data?.error?.message || 'remote stop failed');
    return res.data;
  }

  async start(host, containerId) {
    if (this.isLocal(host)) return null;
    const res = await axios.post(
      `${conductorBase()}/api/workers/${encodeURIComponent(host.id)}/containers/${encodeURIComponent(containerId)}/start`,
      {},
      { headers: this.headers(), timeout: 20000, validateStatus: () => true },
    );
    if (res.status >= 400) throw httpError(res.status, res.data?.error?.message || 'remote start failed');
    return res.data;
  }

  async remove(host, containerId) {
    if (this.isLocal(host)) return null;
    const res = await axios.delete(
      `${conductorBase()}/api/workers/${encodeURIComponent(host.id)}/containers/${encodeURIComponent(containerId)}`,
      { headers: this.headers(), timeout: 20000, validateStatus: () => true },
    );
    if (res.status >= 400 && res.status !== 404) {
      throw httpError(res.status, res.data?.error?.message || 'remote remove failed');
    }
    return res.data;
  }

  async stats(host, containerId) {
    if (this.isLocal(host)) return null;
    const res = await axios.get(
      `${conductorBase()}/api/workers/${encodeURIComponent(host.id)}/containers/${encodeURIComponent(containerId)}/stats`,
      { headers: this.headers(), timeout: 8000, validateStatus: () => true },
    );
    if (res.status >= 400) throw httpError(res.status, res.data?.error?.message || 'remote stats failed');
    return res.data?.stats || res.data;
  }

  async logs(host, containerId, tail) {
    if (this.isLocal(host)) return null;
    const q = tail != null ? `?tail=${encodeURIComponent(tail)}` : '';
    const res = await axios.get(
      `${conductorBase()}/api/workers/${encodeURIComponent(host.id)}/containers/${encodeURIComponent(containerId)}/logs${q}`,
      { headers: this.headers(), timeout: 20000, validateStatus: () => true },
    );
    if (res.status >= 400) throw httpError(res.status, res.data?.error?.message || 'remote logs failed');
    return { logs: res.data?.logs || '' };
  }
}

module.exports = { FleetExec };
