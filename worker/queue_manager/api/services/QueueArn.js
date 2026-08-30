'use strict';

const arn = require('../../../shared/arn');

const SCOPE_BY_ACTION = {
  send: 'queue:Send',
  receive: 'queue:Receive',
  delete: 'queue:Delete',
  admin: 'queue:Admin',
};

function arnSlug(name) {
  return String(name).trim().toLowerCase();
}

function buildQueueArn(projectId, name) {
  return arn.build({
    projectId,
    namespace: 'queue',
    resourceType: 'queue',
    name: arnSlug(name),
  });
}

function plainRow(row) {
  if (!row) return row;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return { ...row };
}

function enrichQueue(row) {
  if (!row) return row;
  const base = plainRow(row);
  const queueArn = base.arn || buildQueueArn(base.project_id, base.name);
  return {
    ...base,
    arn: queueArn,
    invoke_scope: SCOPE_BY_ACTION,
  };
}

function presentQueue(row) {
  const e = enrichQueue(row);
  return {
    id: e.id,
    name: e.name,
    project_id: e.project_id,
    arn: e.arn,
    invoke_scope: e.invoke_scope,
    visibility_timeout_seconds: e.visibility_timeout_seconds,
    created_at: e.created_at,
  };
}

module.exports = {
  buildQueueArn,
  enrichQueue,
  presentQueue,
  SCOPE_BY_ACTION,
};
