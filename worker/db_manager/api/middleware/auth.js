const axios = require('axios');
const jwt = require('jsonwebtoken');

async function validateServiceToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: { message: 'Token required', status: 401 }
    });
  }
  
  // Try to validate as service token first (if CONDUCTOR_URL is set)
  if (process.env.CONDUCTOR_URL) {
    try {
      const response = await axios.post(
        `${process.env.CONDUCTOR_URL}/api/services/validate-token`,
        { token },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );
      
      req.service = response.data.service; // Attach service info
      return next();
    } catch (error) {
      // If validation endpoint doesn't exist (404), fall through to JWT validation
      if (error.response?.status === 404) {
        console.warn('[auth] Token validation endpoint not found. Trying JWT validation.');
      } else if (error.response?.status === 401) {
        // Invalid service token, try JWT validation
        console.log('[auth] Not a service token, trying JWT validation.');
      } else {
        // Other errors (network, etc.), try JWT validation
        console.warn('[auth] Service token validation failed, trying JWT validation:', error.message);
      }
    }
  }
  
  // Try to validate as user JWT token
  // This allows requests from conductor (which forwards user JWT tokens)
  try {
    // Use the same JWT_SECRET as conductor (default matches conductor's default)
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach user info to request
    req.user = decoded;
    req.userId = decoded.id;
    
    return next();
  } catch (jwtError) {
    try {
      const { verify, normalizeAuthClaims } = require('../../../shared/authManagerClient');
      const result = await verify(token);
      if (result && result.active) {
        req.auth = normalizeAuthClaims(result.claims || result);
        req.service = { name: 'db_manager', app: true };
        return next();
      }
    } catch (_) { /* fall through */ }
    return res.status(401).json({
      error: { message: 'Invalid token', status: 401 }
    });
  }
}

module.exports = validateServiceToken;
