const axios = require('axios');
const logger = require('../utils/logger');
const { verify, normalizeAuthClaims } = require('../../../shared/authManagerClient');

/**
 * Accept conductor-registered service tokens or auth_manager app credentials.
 * Icarus C0 / app proxies present typ=app JWTs, not Service.service_token.
 */
async function validateServiceToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: { message: 'Service token required', status: 401 }
    });
  }

  // Automated tests: no conductor; accept configured SERVICE_TOKEN
  if (process.env.NODE_ENV === 'test' && process.env.SERVICE_TOKEN && token === process.env.SERVICE_TOKEN) {
    req.service = { name: 'storage_manager' };
    return next();
  }

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
      req.service = response.data.service;
      return next();
    } catch (error) {
      if (error.response?.status === 404) {
        logger.error('[auth] Token validation endpoint not found in conductor');
        return res.status(503).json({
          error: { message: 'Service authentication unavailable', status: 503 }
        });
      }
      if (error.response?.status && error.response.status !== 401) {
        logger.error('[auth] Token validation failed:', error.message);
        return res.status(503).json({
          error: { message: 'Service authentication unavailable', status: 503 }
        });
      }
      /* 401 or network: try auth_manager app credential */
    }
  }

  try {
    const result = await verify(token);
    if (result && result.active) {
      req.auth = normalizeAuthClaims(result.claims || result);
      req.service = { name: 'storage_manager', app: true };
      return next();
    }
  } catch (e) {
    logger.error('[auth] auth_manager verify failed:', e.message);
  }

  logger.error('[auth] Invalid service token');
  return res.status(401).json({
    error: { message: 'Invalid service token', status: 401 }
  });
}

module.exports = validateServiceToken;
