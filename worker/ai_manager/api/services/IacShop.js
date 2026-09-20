'use strict';

const { fail } = require('./agentArn');
const shop = require('./AgentShop');

function schema() {
  try {
    const { emptyStack, listClickOps } = require('../../../shared/clickOpsCatalog');
    const stack = emptyStack('');
    const keys = listClickOps().map((o) => ({ service: o.name, stackKey: o.stackKey, fields: (o.fields || []).map((f) => f.key) }));
    return { ok: true, kind: 'project-stack', keys, example: { kind: 'project-stack', wanted: ['queue_manager'], queues: [{ name: 'jobs', engine: 'standard' }] }, empty: stack };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function sanitizeWanted(wanted) {
  return (wanted || []).map(String).filter((n) => n && n !== 'auth_manager' && n !== 'vllm');
}

async function put(projectId, stack, { proxy } = {}) {
  if (projectId === shop.PROD_PROJECT) throw fail(403, 'never apply to the production project');
  const px = proxy || ((...a) => require('../../../shared/conductorProxy').proxy(...a));
  const body = { kind: 'project-stack', project_id: projectId, ...stack };
  if (Array.isArray(body.wanted)) body.wanted = sanitizeWanted(body.wanted);
  const res = await px('PUT', `/api/projects/${encodeURIComponent(projectId)}/stack`, {
    timeout: 20000,
    data: body,
  });
  return { ok: (res.status || 200) < 400, stack: res.data, status: res.status };
}

async function apply(projectId, { proxy } = {}) {
  if (projectId === shop.PROD_PROJECT) throw fail(403, 'never apply to the production project');
  const px = proxy || ((...a) => require('../../../shared/conductorProxy').proxy(...a));
  const res = await px('POST', `/api/projects/${encodeURIComponent(projectId)}/stack/apply`, { timeout: 120000, data: {} });
  return { ok: (res.status || 200) < 400, result: res.data, status: res.status };
}

async function diff(projectId, { proxy } = {}) {
  const px = proxy || ((...a) => require('../../../shared/conductorProxy').proxy(...a));
  const res = await px('POST', `/api/projects/${encodeURIComponent(projectId)}/stack/diff`, { timeout: 15000, data: {} });
  return { ok: true, diff: res.data };
}

async function rollback(projectId, { proxy } = {}) {
  if (projectId === shop.PROD_PROJECT) throw fail(403, 'never apply to the production project');
  const px = proxy || ((...a) => require('../../../shared/conductorProxy').proxy(...a));
  const res = await px('POST', `/api/projects/${encodeURIComponent(projectId)}/stack/rollback`, { timeout: 30000, data: {} });
  return { ok: (res.status || 200) < 400, result: res.data };
}

module.exports = { schema, put, apply, diff, rollback, sanitizeWanted };
