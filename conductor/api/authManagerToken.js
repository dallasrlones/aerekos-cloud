const axios = require('axios');

/**
 * Mints + caches a client_credentials token from auth_manager so the conductor can
 * present a valid auth_manager token when proxying to auth-gated manager services
 * (e.g. ai_manager). Best-effort: returns null if auth_manager isn't configured or
 * reachable, so the proxy falls back to the conductor service token and never breaks.
 *
 * Config (env):
 *   AUTH_MANAGER_URL          base URL (e.g. http://auth_manager:3116)
 *   CONDUCTOR_CLIENT_SECRET   secret for the built-in `conductor` client
 *   AUTH_MANAGER_GATED_SERVICES  comma list of services to attach tokens for
 */
let cache = null; // { token, exp }

function gatedServices() {
  const raw = process.env.AUTH_MANAGER_GATED_SERVICES || 'ai_manager';
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

async function ensureClientSecret() {
  if (process.env.CONDUCTOR_CLIENT_SECRET || process.env.AUTH_MANAGER_SECRET) return;
  try {
    const { bootstrapPlatformSecrets } = require('./platformSecrets');
    await bootstrapPlatformSecrets();
  } catch (_) { /* secrets_manager may not be up yet */ }
}

async function getToken() {
  const base = (process.env.AUTH_MANAGER_URL || '').replace(/\/$/, '');
  if (!base) return null;
  if (cache && cache.exp > Date.now() + 30000) return cache.token;
  await ensureClientSecret();
  const clientSecret = process.env.CONDUCTOR_CLIENT_SECRET || process.env.AUTH_MANAGER_SECRET || '';
  if (!clientSecret) return null;
  try {
    const { data } = await axios.post(`${base}/api/v1/auth/token`, {
      grant_type: 'client_credentials',
      client_id: process.env.AUTH_MANAGER_CLIENT_ID || 'conductor',
      client_secret: clientSecret,
      scope: 'services',
    }, { timeout: 5000 });
    cache = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
    return cache.token;
  } catch (_) {
    return null;
  }
}

function isGated(serviceName) {
  return gatedServices().has(serviceName);
}

module.exports = { getToken, isGated };
