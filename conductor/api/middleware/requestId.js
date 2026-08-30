const { randomUUID } = require('crypto');

/**
 * Request ID middleware
 * Adds a unique request ID to each request for correlation tracking
 */
function requestIdMiddleware(req, res, next) {
  // Generate or use existing request ID
  req.id = req.headers['x-request-id'] || randomUUID();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);
  
  next();
}

module.exports = requestIdMiddleware;
