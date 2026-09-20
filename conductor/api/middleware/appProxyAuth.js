const jwt = require('jsonwebtoken');
const axios = require('axios');
const authenticate = require('./auth');
const { Service } = require('../models');

const AUTH_ISSUER = 'aerekos-auth_manager';

async function verifyAppToken(token) {
  const base = (process.env.AUTH_MANAGER_URL || '').replace(/\/$/, '');
  if (!base) return null;
  try {
    const { data } = await axios.post(`${base}/api/v1/auth/verify`, { token }, { timeout: 5000 });
    if (data && data.active && data.claims) return data.claims;
  } catch (_) { /* auth_manager down */ }
  return null;
}

function normalizeAppClaims(claims) {
  const resources = claims.resources || claims.allowed_resources || [];
  const scopeClaim = claims.scope ?? claims.scopes;
  const scopes = Array.isArray(scopeClaim)
    ? scopeClaim
    : (typeof scopeClaim === 'string' ? scopeClaim.split(/\s+/).filter(Boolean) : []);
  return {
    ...claims,
    typ: claims.typ || 'app',
    project_id: claims.project_id || claims.projectId || null,
    resources: Array.isArray(resources) ? resources : [],
    scope: typeof scopeClaim === 'string' ? scopeClaim : scopes.join(' '),
    scopes,
  };
}

function peekPayload(token) {
  try {
    return jwt.decode(token) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Classify proxy caller: service registry token | auth_manager app credential | conductor user JWT.
 * App JWTs are verified and forwarded unchanged (no conductor token swap).
 */
async function appProxyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }

  const token = authHeader.substring(7);
  req.bearerToken = token;

  try {
    const services = await Service.findAll({ where: { service_token: token } });
    if (services.length > 0) {
      req.service = { id: services[0].id, name: services[0].name, token };
      req.tokenType = 'service';
      req.isAppCredential = false;
      return next();
    }
  } catch (_) { /* fall through */ }

  const workerAllowed = [
    process.env.WORKER_REGISTRATION_TOKEN,
    process.env.WORKER_TOKEN,
    process.env.CONDUCTOR_TOKEN,
  ].filter(Boolean);
  if (token && workerAllowed.includes(token)) {
    req.service = { id: 'worker', name: 'worker', token };
    req.tokenType = 'service';
    req.isAppCredential = false;
    return next();
  }

  const payload = peekPayload(token);
  if (payload && payload.iss === AUTH_ISSUER && payload.typ === 'app') {
    const claims = await verifyAppToken(token);
    if (!claims) {
      return res.status(401).json({
        error: { message: 'invalid app credential token', status: 401, code: 'InvalidAppToken' },
      });
    }
    req.auth = normalizeAppClaims(claims);
    req.tokenType = 'app';
    req.isAppCredential = true;
    req.appCredential = true;
    return next();
  }

  return authenticate(req, res, (err) => {
    if (err) return next(err);
    req.tokenType = 'user';
    req.isAppCredential = false;
    next();
  });
}

module.exports = appProxyAuth;
