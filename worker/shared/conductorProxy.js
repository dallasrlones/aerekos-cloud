'use strict';

const axios = require('axios');

function skipFlag(name) {
  const v = process.env[name];
  return v === '1' || v === 'true';
}

function conductorBase() {
  return String(process.env.CONDUCTOR_URL || process.env.CONDUCTOR_INTERNAL_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

function authHeaders(projectId, extra = {}) {
  const tok = process.env.CONDUCTOR_TOKEN
    || process.env.SERVICE_TOKEN
    || process.env.AEREKOS_AGENT_TOKEN
    || '';
  return {
    ...(tok ? {
      Authorization: `Bearer ${tok}`,
      // Releases + some managers accept agent token header (UUID bearer alone can 401)
      'x-aerekos-agent-token': tok,
    } : {}),
    ...(projectId ? { 'x-project-id': projectId } : {}),
    'Content-Type': 'application/json',
    ...extra,
  };
}

function proxy(method, path, opts = {}) {
  if (method && typeof method === 'object' && (method.path || method.service)) {
    const o = method;
    const p = o.service
      ? `/api/services/${o.service}${String(o.path || '').startsWith('/') ? o.path : `/${o.path || ''}`}`
      : o.path;
    return proxy(o.method || 'GET', p, {
      projectId: o.projectId,
      data: o.body || o.data,
      timeout: o.timeout,
      headers: o.headers,
      responseType: o.responseType,
    });
  }
  const { projectId, data, timeout, headers, responseType } = opts;
  return axios({
    method,
    url: `${conductorBase()}${path}`,
    data,
    headers: authHeaders(projectId, headers),
    timeout: timeout || 30000,
    validateStatus: () => true,
    responseType,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
}

module.exports = { skipFlag, conductorBase, authHeaders, proxy };
