'use strict';

const { proxy } = require('../../../shared/conductorProxy');
const { IntelligenceJob } = require('../models');

async function ensureInbox(projectId, inbox) {
  const dlq = inbox.endsWith('-inbox') ? inbox.replace(/-inbox$/, '-dlq') : `${inbox}-dlq`;
  const r = await proxy('POST', '/api/services/queue_manager/api/v1/queues', {
    projectId,
    timeout: 10000,
    data: { project_id: projectId, name: inbox, engine: 'rabbitmq', dlq, visibility_timeout_seconds: 3600 },
  });
  if (r.status >= 400 && r.status !== 409) {
    const e = new Error(r.data?.error?.message || `queue ${r.status}`);
    e.status = r.status;
    throw e;
  }
  await proxy('POST', '/api/services/queue_manager/api/v1/queues', {
    projectId,
    timeout: 8000,
    data: { project_id: projectId, name: dlq, engine: 'rabbitmq' },
  }).catch(() => {});
  return inbox;
}

async function publish(projectId, inbox, body) {
  const r = await proxy('POST', `/api/services/queue_manager/api/v1/queues/${encodeURIComponent(inbox)}/messages`, {
    projectId,
    timeout: 10000,
    data: { project_id: projectId, body },
  });
  if (r.status >= 400) {
    const e = new Error(r.data?.error?.message || `enqueue ${r.status}`);
    e.status = 502;
    throw e;
  }
  return r.data;
}

async function chatRunning(projectId) {
  const rows = await IntelligenceJob.findAll({ where: { project_id: projectId, status: 'running' } }).catch(() => []);
  return (rows || []).length > 0;
}

module.exports = { ensureInbox, publish, chatRunning };
