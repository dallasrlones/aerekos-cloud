const { Service } = require('../models');

/**
 * Service authentication middleware
 * Validates service tokens for service-to-service communication
 */
async function authenticateService(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          message: 'Service token required',
          status: 401
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Find service by token
    const services = await Service.findAll({ 
      where: { service_token: token } 
    });
    
    if (services.length === 0) {
      return res.status(401).json({
        error: {
          message: 'Invalid service token',
          status: 401
        }
      });
    }

    const service = services[0];
    
    // Attach service info to request
    req.service = {
      id: service.id,
      name: service.name,
      token: token
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        message: error.message || 'Service authentication failed',
        status: 401
      }
    });
  }
}

module.exports = authenticateService;

