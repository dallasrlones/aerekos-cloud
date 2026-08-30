const jwt = require('jsonwebtoken');
const { getSecretValue } = require('../../../shared/secretsClient');
const { CredentialService } = require('./CredentialService');

const credentialService = new CredentialService();

/**
 * TokenService — auth_manager's token issuer/verifier.
 * Signing secret is loaded from secrets_manager (KMS envelope) when configured,
 * else AUTH_MANAGER_SECRET env, else dev fallback.
 */
const ISSUER = 'aerekos-auth_manager';

let cachedSecret = null;
let cachedConductorClientSecret = null;

async function loadSigningSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_MANAGER_SECRET) {
    cachedSecret = process.env.AUTH_MANAGER_SECRET;
    return cachedSecret;
  }
  const name = process.env.AUTH_MANAGER_SECRET_NAME || 'auth_manager.signing_secret';
  try {
    const fromKms = await getSecretValue(name);
    if (fromKms) {
      cachedSecret = fromKms;
      process.env.AUTH_MANAGER_SECRET = fromKms;
      return cachedSecret;
    }
  } catch (_) { /* secrets_manager unavailable */ }
  cachedSecret = process.env.JWT_SECRET || 'aerekos-auth-manager-dev-secret-change-me';
  return cachedSecret;
}

function secret() {
  return cachedSecret || process.env.AUTH_MANAGER_SECRET || process.env.JWT_SECRET || 'aerekos-auth-manager-dev-secret-change-me';
}

async function loadConductorClientSecret() {
  if (cachedConductorClientSecret) return cachedConductorClientSecret;
  if (process.env.CONDUCTOR_CLIENT_SECRET) {
    cachedConductorClientSecret = process.env.CONDUCTOR_CLIENT_SECRET;
    return cachedConductorClientSecret;
  }
  const name = process.env.CONDUCTOR_CLIENT_SECRET_NAME || 'conductor.client_secret';
  try {
    const fromKms = await getSecretValue(name);
    if (fromKms) {
      cachedConductorClientSecret = fromKms;
      process.env.CONDUCTOR_CLIENT_SECRET = fromKms;
      return cachedConductorClientSecret;
    }
  } catch (_) { /* secrets_manager unavailable */ }
  cachedConductorClientSecret = secret();
  return cachedConductorClientSecret;
}

/** Call at boot before accepting traffic. */
async function bootstrapSecrets() {
  await loadSigningSecret();
  await loadConductorClientSecret();
}

function clients() {
  const map = new Map();
  if (process.env.AUTH_CLIENTS) {
    try {
      const arr = JSON.parse(process.env.AUTH_CLIENTS);
      for (const c of arr) if (c && c.id && c.secret) map.set(c.id, { secret: c.secret, scopes: c.scopes || ['*'] });
    } catch (_) {}
  }
  if (process.env.AUTH_CLIENT_ID && process.env.AUTH_CLIENT_SECRET) {
    map.set(process.env.AUTH_CLIENT_ID, { secret: process.env.AUTH_CLIENT_SECRET, scopes: ['*'] });
  }
  map.set('conductor', { secret: cachedConductorClientSecret || process.env.CONDUCTOR_CLIENT_SECRET || secret(), scopes: ['*'] });
  return map;
}

function defaultTtl() {
  return parseInt(process.env.AUTH_TOKEN_TTL_SECONDS || '3600', 10);
}

const TokenService = {
  issuer: ISSUER,
  bootstrapSecrets,
  loadSigningSecret,

  async issueClientToken({ client_id, client_secret, scope, audience }) {
    const reg = clients().get(client_id);
    if (reg && reg.secret === client_secret) {
      const requested = (scope || '').trim();
      const grantedScopes = reg.scopes.includes('*') ? (requested || '*') : reg.scopes.join(' ');
      const ttl = defaultTtl();
      const token = this.sign({ sub: client_id, scope: grantedScopes, aud: audience || 'aerekos', typ: 'service' }, ttl);
      return { access_token: token, token_type: 'Bearer', expires_in: ttl, scope: grantedScopes };
    }

    const app = await credentialService.verifyClient(client_id, client_secret);
    if (!app) {
      const e = new Error('invalid_client'); e.status = 401; throw e;
    }

    const grantedScopes = (app.scopes || []).join(' ') || (scope || '').trim();
    const ttl = parseInt(process.env.APP_TOKEN_TTL_SECONDS || process.env.AUTH_TOKEN_TTL_SECONDS || '3600', 10);
    const token = this.sign({
      sub: app.sub,
      typ: 'app',
      project_id: app.project_id,
      resources: app.resources,
      scope: grantedScopes,
      aud: audience || 'aerekos',
    }, ttl);
    return { access_token: token, token_type: 'Bearer', expires_in: ttl, scope: grantedScopes };
  },

  sign(claims, ttlSeconds = defaultTtl()) {
    return jwt.sign({ ...claims }, secret(), { algorithm: 'HS256', issuer: ISSUER, expiresIn: ttlSeconds });
  },

  verify(token) {
    try {
      return jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: ISSUER });
    } catch (err) {
      const e = new Error(`invalid_token: ${err.message}`); e.status = 401; throw e;
    }
  },
};

module.exports = TokenService;
