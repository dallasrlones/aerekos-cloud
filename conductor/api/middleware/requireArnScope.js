const { requireShared } = require('../utils/loadWorkerShared');
const arn = requireShared('arn');
const scope = requireShared('scope');

function extractResourceArn(req) {
  const header = req.headers['x-aerekos-resource'];
  const fromBody = req.body && req.body.resource;
  const value = (typeof fromBody === 'string' && fromBody) || (typeof header === 'string' && header) || null;
  if (!value || !arn.parse(value)) return null;
  return value;
}

/**
 * Optional conductor-edge ARN scope check for app credentials before proxying.
 * @param {{ requiredScope: string }} options
 */
function requireArnScope(options = {}) {
  const { requiredScope } = options;
  return (req, res, next) => {
    if (!req.isAppCredential || !req.auth) return next();
    if (!requiredScope) return next();

    const resourceArn = extractResourceArn(req);
    if (!resourceArn) {
      return res.status(400).json({
        error: {
          code: 'ResourceRequired',
          message: 'resource ARN required in body.resource or X-Aerekos-Resource',
          status: 400,
        },
      });
    }

    const allowed = req.auth.resources || [];
    if (!arn.isAllowed(allowed, resourceArn)) {
      return res.status(403).json({
        error: {
          code: 'ResourceNotAllowed',
          message: 'credential is not authorized for this resource',
          resource: resourceArn,
          status: 403,
        },
      });
    }

    const granted = req.auth.scope || req.auth.scopes;
    if (!scope.hasScope(granted, requiredScope)) {
      return res.status(403).json({
        error: {
          code: 'InsufficientScope',
          message: `required scope: ${requiredScope}`,
          resource: resourceArn,
          status: 403,
        },
      });
    }

    req.resourceArn = resourceArn;
    return next();
  };
}

module.exports = { requireArnScope, extractResourceArn };
