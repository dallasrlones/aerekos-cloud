'use strict';

const { proxy } = require('../../../shared/conductorProxy');

const CHECK_TIMEOUT_MS = 120 * 1000;
const UPDATE_TIMEOUT_MS = 16 * 60 * 1000;

function fwdHeaders(req) {
  const headers = {};
  if (req?.headers?.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  return headers;
}

function proxyFailed(err) {
  const message = err?.message || 'Conductor host proxy failed';
  return {
    status: 503,
    data: { error: { message, status: 503 } },
  };
}

class HostService {
  async check(workerId, req) {
    try {
      return await proxy('POST', `/api/workers/${encodeURIComponent(workerId)}/host/check`, {
        headers: fwdHeaders(req),
        timeout: CHECK_TIMEOUT_MS,
      });
    } catch (err) {
      return proxyFailed(err);
    }
  }

  async update(workerId, target, req) {
    try {
      return await proxy('POST', `/api/workers/${encodeURIComponent(workerId)}/host/update`, {
        data: { target },
        headers: fwdHeaders(req),
        timeout: UPDATE_TIMEOUT_MS,
      });
    } catch (err) {
      return proxyFailed(err);
    }
  }
}

module.exports = { HostService };
