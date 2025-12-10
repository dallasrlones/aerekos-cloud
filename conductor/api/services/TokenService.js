const { randomUUID } = require('crypto');
const TokenRepository = require('../repos/TokenRepository');
const { Token } = require('../models');

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
    
    // Optional: Set expiration (default: no expiration)
    const expiresAt = null; // Can be set to future date if needed
    
    await this.tokenRepository.create({
      token,
      expires_at: expiresAt,
      active: 1 // SQLite: 1 = true, 0 = false
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
    // Invalidate all existing tokens
    await this.tokenRepository.invalidateAllTokens();
    
    // Generate new token
    return await this.generateRegistrationToken();
  }
}

module.exports = new TokenService(TokenRepository);
