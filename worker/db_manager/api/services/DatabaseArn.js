'use strict';

const arn = require('../../../shared/arn');

const SCOPE_BY_ACTION = {
  connect: 'db:Connect',
  query: 'db:Query',
  admin: 'db:Admin',
};

function buildDatabaseArn(projectId, name) {
  return arn.build({
    projectId,
    namespace: 'db',
    resourceType: 'database',
    name: String(name).trim(),
  });
}

function parseDatabaseArn(raw) {
  const p = arn.parse(raw);
  if (!p || p.namespace !== 'db' || p.resourceType !== 'database') return null;
  return p;
}

function plainRow(row) {
  if (!row) return row;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return { ...row };
}

function enrichDatabase(row) {
  if (!row) return row;
  const base = plainRow(row);
  const databaseArn = base.arn || buildDatabaseArn(base.project_id, base.name);
  return {
    ...base,
    arn: databaseArn,
    invoke_scope: SCOPE_BY_ACTION,
  };
}

/** Strip secrets before API responses. */
function presentDatabase(row) {
  const e = enrichDatabase(row);
  const {
    password_hash: _ph,
    password_encrypted: _pe,
    connection_string: _cs,
    ...safe
  } = e;
  return safe;
}

module.exports = {
  buildDatabaseArn,
  parseDatabaseArn,
  enrichDatabase,
  presentDatabase,
  SCOPE_BY_ACTION,
};
