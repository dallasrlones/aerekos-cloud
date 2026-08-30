'use strict';

const arn = require('../../../shared/arn');

const SCOPE_BY_ACTION = {
  run: 'compute:Run',
  stop: 'compute:Stop',
  describe: 'compute:Describe',
};

function buildTaskArn(projectId, name) {
  return arn.build({
    projectId,
    namespace: 'compute',
    resourceType: 'task',
    name: String(name).trim(),
  });
}

function plainRow(row) {
  if (!row) return row;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return { ...row };
}

function enrichTask(row) {
  if (!row) return row;
  const base = plainRow(row);
  const taskArn = base.arn || buildTaskArn(base.project_id, base.name);
  return {
    ...base,
    arn: taskArn,
    invoke_scope: SCOPE_BY_ACTION,
  };
}

module.exports = {
  buildTaskArn,
  enrichTask,
  SCOPE_BY_ACTION,
};
