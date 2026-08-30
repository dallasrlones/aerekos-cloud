const authManagerToken = require('./authManagerToken');

/**
 * Authorization header for manager proxy.
 * App credentials: passthrough unchanged.
 * Human user on gated services: conductor service token (legacy until IAM).
 * Service registry token: passthrough.
 */
async function authorizationForProxy(req, serviceName) {
  if (req.isAppCredential && req.bearerToken) {
    return req.bearerToken;
  }
  if (req.service && req.service.token) {
    return req.service.token;
  }
  if (req.tokenType === 'user' && authManagerToken.isGated(serviceName)) {
    return authManagerToken.getToken();
  }
  return req.bearerToken || null;
}

module.exports = { authorizationForProxy };
