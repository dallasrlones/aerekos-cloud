'use strict';

const { ProjectMember } = require('../models');

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
  return ProjectMember.findAll({ where: { project_id: projectId } })
    .then((members) => {
      if (!members.length) return next();
      const uid = req.userId || req.user?.id;
      if (members.some((m) => String(m.user_id) === String(uid))) return next();
      return res.status(403).json({
        error: { message: 'not a member of this project', code: 'PROJECT_MEMBER_REQUIRED', status: 403 },
      });
    })
    .catch(next);
}

module.exports = { requireProjectMember };
