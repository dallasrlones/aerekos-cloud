const jwt = require('jsonwebtoken');
const { getSecretValue } = require('../../../shared/secretsClient');
const { CredentialService } = require('./CredentialService');

const credentialService = new CredentialService();

/**
 * TokenService — auth_manager's token issuer/verifier.
 *
 * The signing secret's source of truth is the key manager (KMS envelope via
 * secrets_manager) under `auth_manager.signing_secret`. The conductor adopts
 * the same KMS value, so user JWTs it issues verify here. The
 * AUTH_MANAGER_SECRET / CONDUCTOR_CLIENT_SECRET env vars are fallbacks.
 */
const ISSUER = 'aerekos-auth_manager';
const SIGNING_SECRET_NAME = process.env.AUTH_MANAGER_SECRET_NAME || 'auth_manager.signing_secret';
const CLIENT_SECRET_NAME = process.env.CONDUCTOR_CLIENT_SECRET_NAME || 'conductor.client_secret';
const DEV_FALLBACK = 'aerekos-auth-manager-dev-secret-change-me';

let cachedSecret = null;
let cachedConductorClientSecret = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Try to load the signing secret from the key manager. Returns true on success. */
async function tryLoadSigningSecretFromKms() {
  if (cachedSecret) return true;
  try {
    const fromKms = await getSecretValue(SIGNING_SECRET_NAME);
    if (fromKms && typeof fromKms === 'string' && fromKms.length) {
      cachedSecret = fromKms;
      process.env.AUTH_MANAGER_SECRET = fromKms;
      return true;
    }
  } catch (_) { /* secrets_manager / KMS unavailable — retry later */ }
  return false;
}

/** Try to load the conductor client secret from the key manager. Returns true on success. */
async function tryLoadClientSecretFromKms() {
  if (cachedConductorClientSecret) return true;
  try {
    const fromKms = await getSecretValue(CLIENT_SECRET_NAME);
    if (fromKms && typeof fromKms === 'string' && fromKms.length) {
      cachedConductorClientSecret = fromKms;
      process.env.CONDUCTOR_CLIENT_SECRET = fromKms;
      return true;
    }
  } catch (_) { /* secrets_manager / KMS unavailable — retry later */ }
  return false;
}

async function loadSigningSecret() {
  if (cachedSecret) return cachedSecret;
  if (await tryLoadSigningSecretFromKms()) return cachedSecret;
  if (process.env.AUTH_MANAGER_SECRET) {
    cachedSecret = process.env.AUTH_MANAGER_SECRET;
    return cachedSecret;
  }
  return process.env.JWT_SECRET || DEV_FALLBACK;
}

function secret() {
  return cachedSecret || process.env.AUTH_MANAGER_SECRET || process.env.JWT_SECRET || DEV_FALLBACK;
}

async function loadConductorClientSecret() {
  if (cachedConductorClientSecret) return cachedConductorClientSecret;
  if (await tryLoadClientSecretFromKms()) return cachedConductorClientSecret;
  if (process.env.CONDUCTOR_CLIENT_SECRET) {
    cachedConductorClientSecret = process.env.CONDUCTOR_CLIENT_SECRET;
    return cachedConductorClientSecret;
  }
  return secret();
}

/**
 * Call at boot: load both secrets from the key manager, retrying while the
 * KMS chain (secrets_manager -> conductor proxy -> key_manager) is coming up.
 * Falls back to env/dev values and keeps retrying in the background so a late
 * KMS recovery is picked up without a restart.
 */
async function bootstrapSecrets() {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const signing = await tryLoadSigningSecretFromKms();
    const client = await tryLoadClientSecretFromKms();
    if (signing && client) break;
    if (attempt < 20) await sleep(5000);
  }

  if (cachedSecret) {
    console.log(`[auth_manager] signing secret loaded from key manager (${SIGNING_SECRET_NAME})`);
  } else if (process.env.AUTH_MANAGER_SECRET) {
    cachedSecret = process.env.AUTH_MANAGER_SECRET;
    console.warn('[auth_manager] KMS signing secret unavailable; using AUTH_MANAGER_SECRET env');
  } else {
    console.warn(`[auth_manager] KMS signing secret unavailable; using fallback secret (will keep retrying)`);
  }

  if (cachedConductorClientSecret) {
    console.log(`[auth_manager] conductor client secret loaded from key manager (${CLIENT_SECRET_NAME})`);
  } else if (process.env.CONDUCTOR_CLIENT_SECRET) {
    cachedConductorClientSecret = process.env.CONDUCTOR_CLIENT_SECRET;
    console.warn('[auth_manager] KMS client secret unavailable; using CONDUCTOR_CLIENT_SECRET env');
  } else {
    cachedConductorClientSecret = secret();
    console.warn('[auth_manager] KMS client secret unavailable; using signing secret as client secret (will keep retrying)');
  }

  // Keep trying in the background so a late KMS recovery is adopted live.
  (async () => {
    while (!cachedSecret || !cachedConductorClientSecret) {
      await sleep(30000);
      if (!cachedSecret) {
        if (await tryLoadSigningSecretFromKms()) console.log('[auth_manager] signing secret loaded from key manager (recovered)');
      }
      if (!cachedConductorClientSecret) {
        if (await tryLoadClientSecretFromKms()) console.log('[auth_manager] conductor client secret loaded from key manager (recovered)');
      }
    }
  })();
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
