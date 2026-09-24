const jwt = require('jsonwebtoken');

/**
 * JWT Service for token generation and verification.
 *
 * Signing secret: the key manager (via secrets_manager KMS envelope) is the
 * source of truth. We adopt `auth_manager.signing_secret` from KMS once the
 * conductor is able to read it (the read path needs this service listening,
 * so it happens shortly after boot). The JWT_SECRET env value is the startup
 * fallback and remains a valid verification candidate so tokens issued before
 * the KMS value was adopted keep working.
 *
 * User tokens carry issuer `aerekos-auth_manager` so the auth_manager can be
 * the single verification authority for all managers' token fallbacks.
 */
const ISSUER = 'aerekos-auth_manager';
const KMS_SECRET_NAME = process.env.JWT_SECRET_NAME || process.env.AUTH_MANAGER_SECRET_NAME || 'auth_manager.signing_secret';
const ENV_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Secret used for new tokens. Starts as the env value, adopts KMS after load.
let signingSecret = ENV_SECRET;
// All secrets tried on verification (most recent first).
let verifyCandidates = [ENV_SECRET];
let kmsLoaded = false;
let loadingPromise = null;

function secretsClient() {
  const { requireShared } = require('../utils/loadWorkerShared');
  return requireShared('secretsClient');
}

/**
 * Load the shared JWT signing secret from the key manager (secrets_manager
 * KMS envelope). Idempotent; concurrent calls share one in-flight load.
 * @returns {Promise<boolean>} true once a KMS secret has been adopted
 */
async function loadKmsSecret() {
  if (kmsLoaded) return true;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const { getSecretValue } = secretsClient();
      const value = await getSecretValue(KMS_SECRET_NAME);
      if (value && typeof value === 'string' && value.length) {
        if (value !== signingSecret) {
          signingSecret = value;
          verifyCandidates = [value, ...verifyCandidates.filter((c) => c !== value)];
        }
        process.env.JWT_SECRET = value;
        kmsLoaded = true;
        console.log(`[JWTService] JWT signing secret loaded from key manager (${KMS_SECRET_NAME})`);
        return true;
      }
    } catch (err) {
      console.warn('[JWTService] KMS signing-secret load failed (keeping JWT_SECRET env for now):', err.message);
    }
    return false;
  })();
  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

class JWTService {
  /**
   * Generate a JWT token for a user
   * @param {object} user - User object (should have id, username, email, role)
   * @returns {string} JWT token
   */
  generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      must_change_password: Number(user.must_change_password) === 1,
      iam_role: user.iam_role || user.role
    };

    return jwt.sign(payload, signingSecret, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: ISSUER
    });
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token
   * @returns {object} Decoded token payload
   * @throws {Error} If token is invalid or expired
   */
  verifyToken(token) {
    let lastError = null;
    for (const candidate of verifyCandidates) {
      try {
        return jwt.verify(token, candidate);
      } catch (error) {
        lastError = error;
        if (error.name === 'TokenExpiredError') {
          throw new Error('Token has expired');
        }
        // Try remaining candidates (secret may have rotated since issue).
      }
    }
    if (lastError && lastError.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw lastError || new Error('Invalid token');
  }

  /**
   * Decode token without verification (for debugging)
   * @param {string} token - JWT token
   * @returns {object} Decoded token payload (not verified)
   */
  decodeToken(token) {
    return jwt.decode(token);
  }
}

const instance = new JWTService();
instance.loadKmsSecret = loadKmsSecret;
instance.ISSUER = ISSUER;

module.exports = instance;
