const authenticate = require('./auth');
const { Service } = require('../models');

/**
 * For /api/services/:serviceName/api/* proxies: accept conductor-registered
 * service Bearer token, else require user JWT (centralized auth at the edge).
 */
async function serviceProxyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const services = await Service.findAll({ where: { service_token: token } });
      if (services.length > 0) {
        req.service = {
          id: services[0].id,
          name: services[0].name,
          token
        };
        return next();
      }
    } catch (e) {
      /* fall through to user auth */
    }
  }
  return authenticate(req, res, next);
}

module.exports = serviceProxyAuth;
