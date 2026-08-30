'use strict';

const { fail } = require('../../../shared/crudCore');

const FORBIDDEN = new Set(['key_manager']);

function load(name) {
  switch (name) {
    case 'storage_manager':
      return require('./storage');
    case 'db_manager':
      return require('./db');
    case 'secrets_manager':
      return require('./secrets');
    case 'git_manager':
      return require('./git');
    case 'logs_manager':
      return require('./logs');
    case 'audit_manager':
      return require('./audit');
    default:
      return require('./generic');
  }
}

function getAdapter(source) {
  const name = String(source || '').trim();
  if (!name) throw fail(400, 'source is required');
  if (FORBIDDEN.has(name)) {
    throw fail(400, 'refusing to dump key_manager key material');
  }
  return load(name);
}

module.exports = { getAdapter, FORBIDDEN };
