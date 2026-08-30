'use strict';

const { fail } = require('../../../shared/crudCore');
const { proxy } = require('../../../shared/conductorProxy');

async function fetchWorkers() {
  if (!process.env.CONDUCTOR_URL && !process.env.CONDUCTOR_INTERNAL_BASE_URL) {
    throw fail(503, 'CONDUCTOR_URL required');
  }
  const res = await proxy('GET', '/api/workers');
  if (res.status >= 400) throw fail(res.status, res.data?.error?.message || `conductor ${res.status}`);
  return res.data?.workers || res.data?.items || [];
}

async function syncAnnotations(service, projectId) {
  if (!projectId) throw fail(400, 'project_id required');
  const workers = await fetchWorkers();
  const existing = await service.list(projectId);
  const upserted = [];
  for (const w of workers) {
    const name = String(w.id || w.hostname || '').trim();
    if (!name) continue;
    const payload = {
      name,
      worker_id: w.id || name,
      key: 'inventory',
      value: JSON.stringify({
        hostname: w.hostname,
        ip_address: w.ip_address,
        status: w.status,
        capabilities: w.capabilities || [],
        roles: w.roles || [],
        last_seen: w.last_seen,
      }),
    };
    const found = existing.find((a) => a.name === name || a.worker_id === w.id);
    if (found) {
      upserted.push(await service.update(found.id, projectId, payload));
    } else {
      upserted.push(await service.create({ project_id: projectId, ...payload }));
    }
  }
  return { upserted: upserted.length, items: upserted };
}

module.exports = { syncAnnotations, fetchWorkers };
