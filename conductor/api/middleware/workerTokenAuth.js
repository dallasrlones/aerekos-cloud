'use strict';

const authenticate = require('./auth');

function workerTokenOk(token) {
  const allowed = [
    process.env.WORKER_REGISTRATION_TOKEN,
    process.env.WORKER_TOKEN,
    process.env.CONDUCTOR_TOKEN,
  ].filter(Boolean);
  return Boolean(token && allowed.includes(token));
}

/**
 * JWT for humans, or the shared worker/conductor token for managers (FleetExec).
 */
function authenticateWorkerOrUser(req, res, next) {
  const raw = req.headers.authorization || '';
  if (raw.startsWith('Bearer ')) {
    const token = raw.slice(7);
    if (workerTokenOk(token)) {
      req.tokenType = 'service';
      req.service = { id: 'worker', name: 'worker', token };
      return next();
    }
  }
  return authenticate(req, res, next);
}

module.exports = { workerTokenOk, authenticateWorkerOrUser };
