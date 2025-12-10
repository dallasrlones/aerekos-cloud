const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * JWT Service for token generation and verification
 */
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
      role: user.role
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token
   * @returns {object} Decoded token payload
   * @throws {Error} If token is invalid or expired
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
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

module.exports = new JWTService();
