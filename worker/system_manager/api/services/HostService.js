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

class HostService {
  async check(workerId, req) {
    return proxy('POST', `/api/workers/${encodeURIComponent(workerId)}/host/check`, {
      headers: fwdHeaders(req),
      timeout: CHECK_TIMEOUT_MS,
    });
  }

  async update(workerId, target, req) {
    return proxy('POST', `/api/workers/${encodeURIComponent(workerId)}/host/update`, {
      data: { target },
      headers: fwdHeaders(req),
      timeout: UPDATE_TIMEOUT_MS,
    });
  }
}

module.exports = { HostService };
