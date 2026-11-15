'use strict';

const arn = require('../../../shared/arn');

const SCOPE_BY_ACTION = {
  dispatch: 'webhook:Dispatch',
  manage: 'webhook:Manage',
};

function arnSlug(name) {
  return String(name).trim().toLowerCase();
}

function buildWebhookArn(projectId, name) {
  return arn.build({
    projectId,
    namespace: 'webhook',
    resourceType: 'endpoint',
    name: arnSlug(name),
  });
}

function plainRow(row) {
  if (!row) return row;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return { ...row };
}

function enrichWebhook(row) {
  if (!row) return row;
  const base = plainRow(row);
  let webhookArn = base.arn || null;
  if (!webhookArn) {
    try {
      webhookArn = buildWebhookArn(base.project_id, base.name);
    } catch {
      // Non-UUID project_id or invalid name — still return the row without ARN.
      return { ...base, arn: null, invoke_scope: SCOPE_BY_ACTION };
    }
  }
  return {
    ...base,
    arn: webhookArn,
    invoke_scope: SCOPE_BY_ACTION,
  };
}

module.exports = {
  buildWebhookArn,
  enrichWebhook,
  SCOPE_BY_ACTION,
};
