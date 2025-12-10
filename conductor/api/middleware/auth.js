const JWTService = require('../services/JWTService');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
function authenticate(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          message: 'No token provided',
          status: 401
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = JWTService.verifyToken(token);

    // Attach user to request
    req.user = decoded;
    req.userId = decoded.id;

    next();
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
