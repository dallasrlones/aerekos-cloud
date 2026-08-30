const logger = require('../utils/logger');

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  logger.error('[Error]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(status).json({
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
      path: req.path
    }
  });
}

module.exports = errorHandler;
