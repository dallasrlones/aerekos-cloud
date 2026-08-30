'use strict';

const ALLOW = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/reset-password',
  '/api/auth/me',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/me',
]);

function deny(res) {
  return res.status(403).json({
    error: {
      message: 'Password must be changed before continuing',
      status: 403,
      code: 'PASSWORD_CHANGE_REQUIRED',
    },
  });
}

function requirePasswordChanged(req, res, next) {
  if (!req.user?.must_change_password) return next();
  const path = (req.originalUrl || req.path || '').split('?')[0];
  if (ALLOW.has(path) || path.endsWith('/reset-password')) return next();
  // JWT can be stale after ops clear the flag (live still uses admin/admin).
  const UserRepository = require('../repos/UserRepository');
  Promise.resolve(UserRepository.findById(req.userId))
    .then((row) => {
      if (row && Number(row.must_change_password) !== 1) return next();
      return deny(res);
    })
    .catch(next);
}

module.exports = { requirePasswordChanged };
