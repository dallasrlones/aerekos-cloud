'use strict';

const { extractResourceArn } = require('./requireArnScope');
const policyEvaluator = require('../services/PolicyEvaluator');

/**
 * Optional IAM enforcement for human JWT proxy requests.
 * App credentials use credential allowed_resources (requireArnScope) instead.
 *
 * Enable with IAM_ENFORCE_PROXY=true. Requires X-Aerekos-Action and resource ARN.
 * Role: X-Aerekos-Role header or req.user.iam_role (falls back to req.user.role).
 */
function requireIamAccess(options = {}) {
  return async (req, res, next) => {
    const enforce =
      process.env.IAM_ENFORCE_PROXY === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.IAM_ENFORCE_PROXY !== 'false');
    if (!enforce) return next();
    if (req.isAppCredential || req.tokenType === 'app') return next();
    if (req.tokenType === 'service') return next();
    if (req.user?.role === 'admin') return next();

    const serviceName = req.params?.serviceName || options.serviceName || 'conductor';
    const action =
      req.headers['x-aerekos-action'] ||
      options.action ||
      `${serviceName}:${String(req.method || 'GET').toUpperCase()}`;

    const projectId =
      req.body?.project_id ||
      req.query?.project_id ||
      req.headers['x-project-id'];
    const resourceArn =
      extractResourceArn(req) ||
      (projectId ? `arn:aerekos:${projectId}:${serviceName}:*` : null);
    if (!resourceArn) {
      return res.status(400).json({
        error: {
          code: 'ResourceRequired',
          message: 'resource ARN required in body.resource or X-Aerekos-Resource',
          status: 400,
        },
      });
    }

    const roleName =
      req.headers['x-aerekos-role'] ||
      req.user?.iam_role ||
      req.user?.role;

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: 'ProjectRequired',
          message: 'project_id required for IAM evaluation',
          status: 400,
        },
      });
    }

    if (!roleName || roleName === 'admin') {
      return res.status(403).json({
        error: {
          code: 'IamRoleRequired',
          message: 'IAM role required (X-Aerekos-Role header or user iam_role claim)',
          status: 403,
        },
      });
    }

    try {
      const evaluation = await policyEvaluator.evaluate({
        projectId,
        roleName,
        action,
        resourceArn,
      });

      if (!evaluation.allowed) {
        return res.status(403).json({
          error: {
            code: 'IamDenied',
            message: evaluation.reason || 'access denied by IAM policy',
            action,
            resource: resourceArn,
            status: 403,
          },
        });
      }

      req.iamEvaluation = evaluation;
      req.resourceArn = resourceArn;
      return next();
    } catch (err) {
      const status = err.status || 503;
      return res.status(status).json({
        error: {
          code: err.code || 'IamUnavailable',
          message: err.message || 'IAM evaluation unavailable',
          status,
        },
      });
    }
  };
}

module.exports = { requireIamAccess };
