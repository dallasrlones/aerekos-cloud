'use strict';

const arn = require('../../../shared/arn');

const SCOPE_BY_ACTION = {
  read: 'git:Read',
  push: 'git:Push',
  admin: 'git:Admin',
};

function arnSlug(name) {
  return String(name).trim().toLowerCase();
}

function buildRepositoryArn(projectId, name) {
  return arn.build({
    projectId,
    namespace: 'git',
    resourceType: 'repository',
    name: arnSlug(name),
  });
}

function plainRow(row) {
  if (!row) return row;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return { ...row };
}

function enrichRepository(row) {
  if (!row) return row;
  const base = plainRow(row);
  const repositoryArn = base.arn || buildRepositoryArn(base.project_id, base.name);
  return {
    ...base,
    arn: repositoryArn,
    invoke_scope: SCOPE_BY_ACTION,
  };
}

module.exports = {
  buildRepositoryArn,
  enrichRepository,
  SCOPE_BY_ACTION,
};
