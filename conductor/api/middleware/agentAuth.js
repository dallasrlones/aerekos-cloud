/**
 * agentAuth — authorize device updater sidecars (and admins) for release reads.
 *
 * A device presents the worker registration token in `x-aerekos-agent-token`
 * (the same WORKER_TOKEN it already uses to register). Admins with a valid JWT
 * are also allowed, so the dashboard can read release info.
 */
const TokenService = require('../services/TokenService');
const authenticate = require('./auth');

module.exports = async function agentAuth(req, res, next) {
  try {
    const presented =
      req.headers['x-aerekos-agent-token'] || req.query.agent_token || null;
    if (presented) {
      const current = await TokenService.getCurrentToken();
      if (current && presented === current) return next();
    }
  } catch (_e) {
    // fall through to JWT auth
  }
  // No (valid) agent token — allow an authenticated admin instead.
  return authenticate(req, res, next);
};
