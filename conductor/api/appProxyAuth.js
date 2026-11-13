const jwt = require('jsonwebtoken');
const axios = require('axios');
const authenticate = require('./middleware/auth');
const { Service } = require('./models');

const AUTH_ISSUER = 'aerekos-auth_manager';

function authError(res, status, code, message, extra = {}) {
  return res.status(status).json({
    error: { code, message, status, ...extra },
  });
}

async function verifyAppToken(token) {
  const base = (process.env.AUTH_MANAGER_URL || '').replace(/\/$/, '');
  if (!base) {
    return { claims: null, reason: 'AUTH_MANAGER_URL not configured on conductor' };
  }
  try {
    const { data } = await axios.post(`${base}/api/v1/auth/verify`, { token }, { timeout: 5000 });
    if (data && data.active && data.claims) {
      return { claims: data.claims, reason: null };
    }
    const inactive = data && data.active === false;
    return {
      claims: null,
      reason: inactive ? 'app credential inactive or revoked' : 'auth_manager verify rejected token',
    };
  } catch (_) {
    return { claims: null, reason: 'auth_manager verify unreachable' };
  }
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

function userPathTokenMismatch(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.iss === AUTH_ISSUER) {
    return {
      code: 'WrongTokenType',
      message: 'auth_manager JWT must have typ "app" for manager proxy routes',
      hint: 'Use POST /api/auth/login for conductor user JWT, or client_credentials for app credentials',
      expectedTokenType: 'app',
      receivedTokenType: payload.typ || 'unknown',
    };
  }
  if (payload.typ === 'app') {
    return {
      code: 'WrongTokenType',
      message: 'app credential JWT must be issued by auth_manager',
      hint: `Expected iss "${AUTH_ISSUER}"; mint via auth_manager client_credentials`,
      expectedTokenType: 'app',
      receivedTokenType: 'app',
    };
  }
  return null;
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
    const { claims, reason } = await verifyAppToken(token);
    if (!claims) {
      return authError(
        res,
        401,
        'InvalidAppToken',
        reason ? `app credential not accepted: ${reason}` : 'app credential not accepted',
        {
          hint: 'Mint via auth_manager client_credentials; conductor console JWTs cannot replace app tokens',
          tokenType: 'app',
        },
      );
    }
    req.auth = normalizeAppClaims(claims);
    req.tokenType = 'app';
    req.isAppCredential = true;
    req.appCredential = true;
    return next();
  }

  const mismatch = userPathTokenMismatch(payload);
  if (mismatch) {
    return authError(res, 401, mismatch.code, mismatch.message, {
      hint: mismatch.hint,
      expectedTokenType: mismatch.expectedTokenType,
      receivedTokenType: mismatch.receivedTokenType,
    });
  }

  return authenticate(req, res, (err) => {
    if (err) return next(err);
    req.tokenType = 'user';
    req.isAppCredential = false;
    next();
  });
}

module.exports = appProxyAuth;
