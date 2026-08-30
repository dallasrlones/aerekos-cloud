const axios = require('axios');

function agentPort(worker) {
  const r = worker?.resources;
  if (typeof r === 'string') {
    try {
      const parsed = JSON.parse(r);
      if (parsed?.agent_port) return Number(parsed.agent_port);
    } catch { /* ignore */ }
  } else if (r?.agent_port) {
    return Number(r.agent_port);
  }
  return 3001;
}

function agentBaseUrl(worker) {
  const ip = worker?.ip_address;
  if (!ip) throw new Error('worker_has_no_ip');
  return `http://${ip}:${agentPort(worker)}`;
}

async function workerAgentRequest(worker, method, path, { params, data, timeout = 30000 } = {}) {
  const url = `${agentBaseUrl(worker)}${path}`;
  const res = await axios({ method, url, params, data, timeout, validateStatus: () => true });
  if (res.status >= 400) {
    const msg = res.data?.error || res.statusText || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.data;
}

module.exports = { agentPort, agentBaseUrl, workerAgentRequest };
