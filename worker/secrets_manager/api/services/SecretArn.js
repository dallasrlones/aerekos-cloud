'use strict';

const arn = require('../../../shared/arn');

const SCOPE_BY_ACTION = {
  get: 'secrets:GetValue',
  list: 'secrets:List',
  put: 'secrets:Put',
};

function buildSecretArn(projectId, name) {
  return arn.build({
    projectId,
    namespace: 'secrets',
    resourceType: 'secret',
    name: String(name).trim(),
  });
}

function plainRow(row) {
  if (!row) return row;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return { ...row };
}

function enrichSecret(row) {
  if (!row) return row;
  const base = plainRow(row);
  const secretArn = base.arn || buildSecretArn(base.project_id, base.name);
  return {
    ...base,
    arn: secretArn,
    invoke_scope: SCOPE_BY_ACTION,
  };
}

module.exports = {
  buildSecretArn,
  enrichSecret,
  SCOPE_BY_ACTION,
};
