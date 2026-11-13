const JWTService = require('../services/JWTService');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request.
 * On Invalid token, reload the KMS signing secret once and retry — covers the
 * race where auth_manager adopted KMS before conductor finished boot retries.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          message: 'No token provided',
          status: 401
        }
      });
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
      decoded = JWTService.verifyToken(token);
    } catch (error) {
      // Do not reload KMS in unit/integration tests — it rotates the signing
      // secret underfoot and turns a valid login JWT into 401 on the next hop.
      if (
        error.message === 'Invalid token'
        && typeof JWTService.loadKmsSecret === 'function'
        && process.env.NODE_ENV !== 'test'
      ) {
        await JWTService.loadKmsSecret();
        decoded = JWTService.verifyToken(token);
      } else {
        throw error;
      }
    }

    req.user = decoded;
    req.userId = decoded.id;

    const { requirePasswordChanged } = require('./requirePasswordChanged');
    return requirePasswordChanged(req, res, next);
  } catch (error) {
    return res.status(401).json({
      error: {
        message: error.message || 'Invalid token',
        status: 401
      }
    });
  }
}

module.exports = authenticate;
