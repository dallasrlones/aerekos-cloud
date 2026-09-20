'use strict';

const { Worker } = require('../models');
const { parseResources } = require('./deviceRoles');
const { canFit, estimateModelGb, DEFAULT_RESERVE_GB } = require('../utils/capacity');

function ramFromResources(res = {}) {
  const ram = res.ram || {};
  const total = Number(ram.total_gb || res.ram_gb || 0);
  const hasLive = ram.used_gb != null || ram.available_gb != null || ram.free_gb != null;
  const used = hasLive
    ? Number(ram.used_gb != null ? ram.used_gb : (total - Number(ram.available_gb || ram.free_gb || 0)))
    : 0;
  const free = hasLive
    ? Number(ram.available_gb || ram.free_gb || Math.max(0, total - used))
    : total;
  return {
    total_gb: total,
    used_gb: used,
    free_gb: free,
    unified: !!(res.gpu && res.gpu.unified),
    live: hasLive,
  };
}

class CapacityService {
  async hosts() {
    const workers = await Worker.findAll();
    return (workers || []).map((w) => {
      const res = parseResources(w.resources);
      const ram = ramFromResources(res);
      return {
        id: w.id,
        hostname: w.hostname,
        display_name: w.display_name || w.hostname,
        status: w.status,
        ram,
        gpu: res.gpu || null,
        processes: (res.processes && res.processes.list) || [],
        loaded_ai: res.loaded_ai || [],
      };
    });
  }

  async pick({ requestGb, reserveGb, preferId, preferHostname } = {}) {
    const hosts = (await this.hosts()).filter((h) => h.status === 'online' || !h.status);
    const scored = [];
    for (const host of hosts) {
      const fit = canFit({
        totalGb: host.ram.total_gb,
        usedGb: host.ram.used_gb,
        requestGb: requestGb != null ? requestGb : 0.5,
        reserveGb: reserveGb != null ? reserveGb : DEFAULT_RESERVE_GB,
        already: host.loaded_ai,
      });
      if (!fit.ok) continue;
      const prefer = host.id === preferId || host.hostname === preferHostname;
      scored.push({ host, fit, prefer });
    }
    scored.sort((a, b) => Number(b.prefer) - Number(a.prefer) || (b.host.ram.free_gb || 0) - (a.host.ram.free_gb || 0));
    if (!scored.length) {
      const e = new Error('no worker has enough memory');
      e.status = 409;
      e.code = 'INSUFFICIENT_MEMORY';
      throw e;
    }
    return scored[0];
  }

  async canFitOn(workerId, { requestGb, reserveGb, already } = {}) {
    const hosts = await this.hosts();
    const host = hosts.find((h) => h.id === workerId || h.hostname === workerId);
    if (!host) {
      const e = new Error('worker not found');
      e.status = 404;
      throw e;
    }
    const fit = canFit({
      totalGb: host.ram.total_gb,
      usedGb: host.ram.used_gb,
      requestGb,
      reserveGb: reserveGb != null ? reserveGb : DEFAULT_RESERVE_GB,
      already: already || host.loaded_ai,
    });
    return { host, fit, estimate_model_gb: estimateModelGb };
  }

  async enqueue(projectId, body = {}) {
    const axios = require('axios');
    const port = process.env.PORT || 3300;
    const base = (process.env.CONDUCTOR_INTERNAL_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
    const headers = { 'x-project-id': projectId, 'Content-Type': 'application/json' };
    try {
      await axios.post(`${base}/api/services/queue_manager/api/v1/queues`, {
        project_id: projectId, name: 'capacity-wait',
      }, { headers, timeout: 8000, validateStatus: () => true });
    } catch (_) { /* exists */ }
    let queued = false;
    try {
      const sent = await axios.post(`${base}/api/services/queue_manager/api/v1/queues/capacity-wait/messages`, {
        project_id: projectId, body: JSON.stringify(body),
      }, { headers, timeout: 8000, validateStatus: () => true });
      queued = sent.status < 400;
    } catch (_) { /* */ }
    try {
      await axios.post(`${base}/api/services/event_manager/api/v1/events`, {
        project_id: projectId, type: 'capacity.denied', source: 'capacity', payload: body,
      }, { headers, timeout: 8000, validateStatus: () => true });
    } catch (_) { /* */ }
    return { queued, queue: 'capacity-wait' };
  }
}

module.exports = new CapacityService();
module.exports.ramFromResources = ramFromResources;
