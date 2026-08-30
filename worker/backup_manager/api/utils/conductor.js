'use strict';

const { proxy, conductorBase, authHeaders } = require('../../../shared/conductorProxy');
const { fail } = require('../../../shared/crudCore');

function servicePath(name, path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `/api/services/${encodeURIComponent(name)}${p}`;
}

function addProjectQuery(path, projectId) {
  if (!projectId) return path;
  if (/[?&]project_id=/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}project_id=${encodeURIComponent(projectId)}`;
}

function errorMessage(name, res) {
  const data = res && res.data;
  if (data && typeof data === 'object' && data.error) {
    return data.error.message || data.error.code || JSON.stringify(data.error);
  }
  if (typeof data === 'string' && data) return data.slice(0, 400);
  return `upstream ${name} HTTP ${res && res.status}`;
}

function throwUpstream(name, res) {
  const status = res.status >= 500 || res.status === 0 ? 502 : res.status;
  throw fail(status, errorMessage(name, res));
}

async function call(name, method, path, opts = {}) {
  const { projectId, data, headers, responseType, timeout } = opts;
  return proxy(method, addProjectQuery(servicePath(name, path), projectId), {
    projectId,
    data,
    headers,
    responseType,
    timeout,
  });
}

async function json(name, method, path, opts = {}) {
  const res = await call(name, method, path, opts);
  if (res.status >= 400) throwUpstream(name, res);
  return res.data;
}

function toBuffer(data) {
  if (data == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (typeof data === 'string') return Buffer.from(data);
  return Buffer.from(JSON.stringify(data));
}

module.exports = {
  call,
  json,
  toBuffer,
  servicePath,
  addProjectQuery,
  throwUpstream,
  conductorBase,
  authHeaders,
};
