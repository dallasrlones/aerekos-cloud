// Dependency-free (uses Node 18+ global fetch) so it resolves correctly when
// copied to /app/shared, independent of any single manager's node_modules.

async function postJson(url, body, timeoutMs = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Shared auth_manager client + Express middleware.
 *
 * Every manager that wants centralized auth uses requireAuth() to verify incoming
 * Bearer tokens against auth_manager's /api/v1/auth/verify. Tokens are minted by
 * auth_manager (client_credentials) and presented by callers (e.g. the conductor
 * when proxying). getServiceToken() lets a manager mint its own token for
 * service-to-service calls.
 *
 * Config (env):
 *   AUTH_MANAGER_URL   base URL of auth_manager (e.g. http://auth_manager:3116)
 *   AUTH_REQUIRED      'true' to enforce; otherwise verification is best-effort
 *   AUTH_CLIENT_ID / AUTH_CLIENT_SECRET   credentials for getServiceToken()
 */

const VERIFY_CACHE = new Map(); // token -> { claims, exp }
const VERIFY_TTL_MS = 30000;

/** Normalize verify claims for app-access middleware (typ, project_id, resources, scope). */
function normalizeAuthClaims(claims) {
  if (!claims || typeof claims !== 'object') return claims;
  const resources = claims.resources || claims.allowed_resources || [];
  const scopeClaim = claims.scope ?? claims.scopes;
  const scopes = Array.isArray(scopeClaim)
    ? scopeClaim
    : (typeof scopeClaim === 'string' ? scopeClaim.split(/\s+/).filter(Boolean) : []);
  return {
    ...claims,
    typ: claims.typ || claims.type || 'service',
    project_id: claims.project_id || claims.projectId || null,
    resources: Array.isArray(resources) ? resources : [],
    scope: typeof scopeClaim === 'string' ? scopeClaim : scopes.join(' '),
    scopes,
  };
}

function authBase() {
  return (process.env.AUTH_MANAGER_URL || '').replace(/\/$/, '');
}

function isRequired() {
  return String(process.env.AUTH_REQUIRED || 'false').toLowerCase() === 'true';
}

async function verify(token) {
  const cached = VERIFY_CACHE.get(token);
  if (cached && cached.exp > Date.now()) return cached.result;
  const base = authBase();
  if (!base) {
    // No auth_manager configured: cannot verify.
    return { active: false, error: 'AUTH_MANAGER_URL not set' };
  }
  const { data } = await postJson(`${base}/api/v1/auth/verify`, { token });
  VERIFY_CACHE.set(token, { result: data, exp: Date.now() + VERIFY_TTL_MS });
  return data;
}

/**
 * Express middleware factory. When auth is required, rejects requests without a
 * valid auth_manager token. When not required, attaches req.auth if a valid token
 * is present but never blocks (keeps backward compatibility during rollout).
 */
function requireAuth(options = {}) {
  const required = options.required !== undefined ? options.required : isRequired();
  return async (req, res, next) => {
    const header = req.headers.authorization;
    const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      if (required) return res.status(401).json({ error: { message: 'authentication required', status: 401 } });
      return next();
    }
    try {
      const result = await verify(token);
      if (result && result.active) {
        const claims = result.claims || result;
        req.auth = normalizeAuthClaims(claims);
        return next();
      }
      if (required) return res.status(401).json({ error: { message: 'invalid token', status: 401 } });
      return next();
    } catch (e) {
      // auth_manager unreachable
      if (required) return res.status(503).json({ error: { message: 'auth service unavailable', status: 503 } });
      return next();
    }
  };
}

let serviceTokenCache = null; // { token, exp }

/** Mint (and cache) a client_credentials token for service-to-service calls. */
async function getServiceToken() {
  const base = authBase();
  const id = process.env.AUTH_CLIENT_ID;
  const secret = process.env.AUTH_CLIENT_SECRET;
  if (!base || !id || !secret) return null;
  if (serviceTokenCache && serviceTokenCache.exp > Date.now() + 30000) return serviceTokenCache.token;
  const { data } = await postJson(`${base}/api/v1/auth/token`, {
    grant_type: 'client_credentials', client_id: id, client_secret: secret,
  });
  serviceTokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return serviceTokenCache.token;
}

module.exports = { requireAuth, verify, getServiceToken, isRequired, normalizeAuthClaims };
