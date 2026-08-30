'use strict';

const arn = require('../../../shared/arn');

const SCOPE_BY_ACTION = {
  read: 'storage:GetObject',
  write: 'storage:PutObject',
  list: 'storage:ListBucket',
  delete: 'storage:DeleteObject',
};

function buildBucketArn(projectId, name) {
  return arn.build({
    projectId,
    namespace: 'storage',
    resourceType: 'bucket',
    name: String(name).trim(),
  });
}

function parseBucketArn(raw) {
  const p = arn.parse(raw);
  if (!p || p.namespace !== 'storage' || p.resourceType !== 'bucket') return null;
  return p;
}

function plainRow(row) {
  if (!row) return row;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return { ...row };
}

function enrichBucket(row) {
  if (!row) return row;
  const base = plainRow(row);
  const bucketArn = base.arn || buildBucketArn(base.project_id, base.name);
  return {
    ...base,
    arn: bucketArn,
    invoke_scope: SCOPE_BY_ACTION,
  };
}

module.exports = {
  buildBucketArn,
  parseBucketArn,
  enrichBucket,
  SCOPE_BY_ACTION,
};
