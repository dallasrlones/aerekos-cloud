const { Token } = require('../models');

/**
 * Token Repository - Database operations for registration tokens
 */
class TokenRepository {
  /**
   * Find active registration token
   * @returns {Promise<object|null>} Active token or null
   */
  async findActiveToken() {
    // SQLite uses integer for boolean: 1 = true, 0 = false
    const tokens = await Token.findAll({ 
      where: { active: 1 }
    });
    
    // Return most recent active token
    if (tokens.length > 0) {
      // Sort by created_at descending
      tokens.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return tokens[0];
    }
    
    return null;
  }

  /**
   * Create a new token
   * @param {object} tokenData - Token data (token, expires_at, active)
   * @returns {Promise<object>} Created token
   */
  async create(tokenData) {
    return await Token.create(tokenData);
  }

  /**
   * Invalidate a token (set active to false)
   * @param {string} tokenValue - Token string value
   * @returns {Promise<object>} Updated token
   */
  async invalidateToken(tokenValue) {
    const tokens = await Token.findAll({ where: { token: tokenValue } });
    if (tokens.length === 0) {
      throw new Error('Token not found');
    }
    
    const token = tokens[0];
    return await Token.update(token.id, { active: 0 }); // 0 = false
  }

  /**
   * Invalidate all tokens (set all active to false)
   * @returns {Promise<number>} Number of tokens invalidated
   */
  async invalidateAllTokens() {
    const tokens = await Token.findAll({ where: { active: 1 } }); // 1 = true
    for (const token of tokens) {
      await Token.update(token.id, { active: 0 }); // 0 = false
    }
    return tokens.length;
  }
}

module.exports = new TokenRepository();
