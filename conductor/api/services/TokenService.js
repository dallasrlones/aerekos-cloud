const { randomUUID } = require('crypto');
const TokenRepository = require('../repos/TokenRepository');
const { Token } = require('../models');
// Token is used by validateToken and regenerate overlap

/**
 * Token Service - Business logic for worker registration tokens
 */
class TokenService {
  constructor(tokenRepository) {
    this.tokenRepository = tokenRepository;
  }

  /**
   * Generate a new registration token for worker registration
   * @returns {Promise<string>} Generated token
   */
  async generateRegistrationToken() {
    const token = randomUUID();
    return this._createActiveToken(token);
  }

  /**
   * Create the first registration token, optionally a fixed value (Docker / dev parity).
   * If a token already exists, returns it and ignores preferredToken.
   * @param {string|null|undefined} preferredToken
   * @returns {Promise<string>}
   */
  async ensureInitialRegistrationToken(preferredToken) {
    const existing = await this.getCurrentToken();
    if (existing) {
      return existing;
    }
    const trimmed = preferredToken != null ? String(preferredToken).trim() : '';
    const token = trimmed.length > 0 ? trimmed : randomUUID();
    return this._createActiveToken(token);
  }

  async _createActiveToken(token) {
    const expiresAt = null;
    await this.tokenRepository.create({
      token,
      expires_at: expiresAt,
      active: 1
    });
    return token;
  }

  /**
   * Validate a registration token
   * @param {string} token - Token to validate
   * @returns {Promise<boolean>} True if token is valid and active
   */
  async validateToken(token) {
    const tokens = await Token.findAll({ where: { token, active: 1 } }); // 1 = true
    
    if (tokens.length === 0) {
      return false;
    }

    const tokenRecord = tokens[0];

    // Check expiration if set
    if (tokenRecord.expires_at) {
      const expiresAt = new Date(tokenRecord.expires_at);
      if (expiresAt < new Date()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get current active registration token
   * @returns {Promise<string|null>} Active token or null
   */
  async getCurrentToken() {
    const token = await this.tokenRepository.findActiveToken();
    return token ? token.token : null;
  }

  /**
   * Regenerate registration token
   * Invalidates old token and creates new one
   * @returns {Promise<string>} New token
   */
  async regenerateToken() {
    const overlapH = Number(process.env.WORKER_TOKEN_OVERLAP_HOURS || 24);
    const tokens = await Token.findAll({ where: { active: 1 } });
    const until = new Date(Date.now() + overlapH * 3600 * 1000).toISOString();
    for (const t of tokens) {
      await Token.update(t.id, { expires_at: until });
    }
    return await this.generateRegistrationToken();
  }
}

module.exports = new TokenService(TokenRepository);
