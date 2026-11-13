'use strict';

const { ProjectMember, Project } = require('../models');
const { MEMBER_ROLES, normalizeRole, roleRank } = require('../utils/projectRoles');

/**
 * If a project has membership rows, non-admins must be listed.
 * Projects with no members stay open so existing installs are not locked out.
 */
function requireProjectMember(req, res, next) {
  if (req.user?.role === 'admin') return next();
  const projectId =
    req.params.id ||
    req.body?.project_id ||
    req.query.project_id ||
    req.headers['x-project-id'];
  if (!projectId) return next();
  return assertProjectMember(req, projectId)
    .then((row) => {
      if (row === false) {
        return res.status(403).json({
          error: { message: 'not a member of this project', code: 'PROJECT_MEMBER_REQUIRED', status: 403 },
        });
      }
      if (row && typeof row === 'object') req.projectMember = row;
      return next();
    })
    .catch(next);
}

/**
 * Require at least `minRole` once membership is enabled on the project.
 * Admins bypass. Empty membership list stays open.
 */
function requireProjectRole(minRole = 'member') {
  const need = roleRank(minRole);
  return function requireRole(req, res, next) {
    if (req.user?.role === 'admin') return next();
    const projectId =
      req.params.id ||
      req.body?.project_id ||
      req.query.project_id ||
      req.headers['x-project-id'];
    if (!projectId) return next();
    return assertProjectMember(req, projectId)
      .then((row) => {
        if (row === false) {
          return res.status(403).json({
            error: { message: 'not a member of this project', code: 'PROJECT_MEMBER_REQUIRED', status: 403 },
          });
        }
        if (row && typeof row === 'object') {
          req.projectMember = row;
          if (roleRank(row.role) < need) {
            return res.status(403).json({
              error: { message: 'insufficient project role', code: 'PROJECT_ROLE_REQUIRED', status: 403 },
            });
          }
        }
        return next();
      })
      .catch(next);
  };
}

/**
 * @returns {Promise<object|null|false>} member row, null if open project, false if denied
 */
async function assertProjectMember(req, projectId) {
  if (!projectId) return null;
  if (req.user?.role === 'admin') return null;
  // Service / app credentials already scoped by auth; do not treat as human members.
  if (req.isService || req.isAppCredential || req.live?.kind === 'worker') return null;
  const members = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  const uid = req.userId || req.user?.id || req.user?.userId || req.user?.sub;
  if (!members.length) {
    // Open project: creator may access as virtual owner; legacy (no created_by) stays open.
    let project = null;
    try {
      const rows = await Project.findAll({ where: { id: String(projectId) } });
      project = rows[0] || null;
    } catch (_) { /* ignore */ }
    const createdBy = project?.created_by ? String(project.created_by) : '';
    if (!createdBy) return null;
    if (!uid) return false;
    if (String(uid) === createdBy) {
      return { project_id: String(projectId), user_id: String(uid), role: 'owner', _virtual: true };
    }
    return false;
  }
  if (!uid) return false;
  const row = members.find((m) => String(m.user_id) === String(uid));
  return row || false;
}

/**
 * Express middleware for manager proxies: when project_id is present and the
 * caller is a human JWT, enforce membership for gated services (ai_manager).
 */
function requireProjectMemberForProxy(serviceNames = ['ai_manager'], { mutateMinRole = 'member' } = {}) {
  const gated = new Set((serviceNames || []).map(String));
  const need = roleRank(mutateMinRole);
  return function proxyMemberGate(req, res, next) {
    const serviceName = req.params.serviceName || req.params.name;
    if (!gated.has(String(serviceName))) return next();
    if (req.user?.role === 'admin') return next();
    if (req.isService || req.isAppCredential) return next();
    const projectId =
      req.body?.project_id ||
      req.query.project_id ||
      req.headers['x-project-id'];
    if (!projectId) return next();
    const method = String(req.method || 'GET').toUpperCase();
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    return assertProjectMember(req, projectId)
      .then((row) => {
        if (row === false) {
          return res.status(403).json({
            error: { message: 'not a member of this project', code: 'PROJECT_MEMBER_REQUIRED', status: 403 },
          });
        }
        if (row && typeof row === 'object') {
          req.projectMember = row;
          if (mutating && roleRank(row.role) < need) {
            return res.status(403).json({
              error: { message: 'insufficient project role', code: 'PROJECT_ROLE_REQUIRED', status: 403 },
            });
          }
        }
        return next();
      })
      .catch(next);
  };
}

async function userIsProjectMember(userId, projectId) {
  if (!userId || !projectId) return false;
  const members = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  if (!members.length) return true; // open project
  return members.some((m) => String(m.user_id) === String(userId));
}

module.exports = {
  requireProjectMember,
  requireProjectRole,
  requireProjectMemberForProxy,
  assertProjectMember,
  userIsProjectMember,
  MEMBER_ROLES,
  normalizeRole,
  roleRank,
};
