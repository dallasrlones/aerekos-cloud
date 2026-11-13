'use strict';

const { requireProjectMember, requireProjectRole, assertProjectMember } = require('./requireProjectMember');
const { roleRank } = require('../utils/projectRoles');

/**
 * After membership is resolved:
 * - GET/HEAD/OPTIONS: any member (or open project) — viewers OK
 * - mutating methods: require at least `member` (viewers 403)
 * Owner-only routes should still stack `requireProjectRole('owner')`.
 */
function requireProjectCapability(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }
  if (req.user?.role === 'admin') return next();
  if (req.isService || req.isAppCredential) return next();

  const projectId =
    req.params.id ||
    req.body?.project_id ||
    req.query.project_id ||
    req.headers['x-project-id'];
  if (!projectId) return next();

  // Self-service leave is allowed for any member including viewers.
  const path = String(req.path || req.url || '');
  if (/\/members\/leave\/?$/.test(path) || /\/members\/leave\/?$/.test(String(req.originalUrl || ''))) {
    return next();
  }

  // Prefer already-loaded membership from requireProjectMember
  const existing = req.projectMember;
  if (existing && typeof existing === 'object') {
    if (roleRank(existing.role) < roleRank('member')) {
      return res.status(403).json({
        error: { message: 'insufficient project role', code: 'PROJECT_ROLE_REQUIRED', status: 403 },
      });
    }
    return next();
  }

  return assertProjectMember(req, projectId)
    .then((row) => {
      if (row === false) {
        return res.status(403).json({
          error: { message: 'not a member of this project', code: 'PROJECT_MEMBER_REQUIRED', status: 403 },
        });
      }
      // Open project (null): allow mutating bootstrap for authenticated users
      // (invite/member routes further gate owner via requireProjectRole).
      if (row && typeof row === 'object' && roleRank(row.role) < roleRank('member')) {
        return res.status(403).json({
          error: { message: 'insufficient project role', code: 'PROJECT_ROLE_REQUIRED', status: 403 },
        });
      }
      if (row && typeof row === 'object') req.projectMember = row;
      return next();
    })
    .catch(next);
}

/** Compose: membership + write capability for /:id routers */
function projectAccessStack() {
  return [requireProjectMember, requireProjectCapability];
}

module.exports = {
  requireProjectCapability,
  projectAccessStack,
  requireProjectMember,
  requireProjectRole,
};
