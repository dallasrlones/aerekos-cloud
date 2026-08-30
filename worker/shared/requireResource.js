'use strict';

const arn = require('./arn');
const scope = require('./scope');

/**
 * Extract resource ARN from request (body.resource or X-Aerekos-Resource header).
 */
function extractResourceArn(req) {
  const header = req.headers['x-aerekos-resource'];
  const fromBody = req.body && req.body.resource;
  const value = (typeof fromBody === 'string' && fromBody) || (typeof header === 'string' && header) || null;
  if (!value) return null;
  return arn.parse(value) ? value : null;
}

/**
 * Express middleware — enforce app credential resource + scope.
 * Human/service tokens (typ !== 'app') pass through when skipNonApp is true (default).
 *
 * @param {{ requiredScope: string, skipNonApp?: boolean }} options
 */
function requireResource(options) {
  const { requiredScope, skipNonApp = true } = options;
  if (!requiredScope) throw new Error('requireResource: requiredScope is required');

  return (req, res, next) => {
    const auth = req.auth || {};
    const typ = auth.typ || auth.type;

    if (skipNonApp && typ !== 'app') {
      return next();
    }

    const resourceArn = extractResourceArn(req);
    if (!resourceArn) {
      return res.status(400).json({
        error: {
          code: 'ResourceRequired',
          message: 'resource ARN required in body.resource or X-Aerekos-Resource header',
          status: 400,
        },
      });
    }

    const allowed = auth.resources || auth.allowed_resources || [];
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

    const granted = auth.scope || auth.scopes;
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
    req.resource = arn.parse(resourceArn);
    return next();
  };
}

/**
 * Scope-only gate for app tokens (e.g. list endpoints without a single resource ARN).
 */
function requireScope(options) {
  const { requiredScope, skipNonApp = true } = options;
  if (!requiredScope) throw new Error('requireScope: requiredScope is required');

  return (req, res, next) => {
    const auth = req.auth || {};
    const typ = auth.typ || auth.type;
    if (skipNonApp && typ !== 'app') return next();

    const granted = auth.scope || auth.scopes;
    if (!scope.hasScope(granted, requiredScope)) {
      return res.status(403).json({
        error: {
          code: 'InsufficientScope',
          message: `required scope: ${requiredScope}`,
          status: 403,
        },
      });
    }
    return next();
  };
}

module.exports = { requireResource, requireScope, extractResourceArn };
