'use strict';

const { proxy } = require('../../../shared/conductorProxy');

async function runNotebook(service, id, projectId, body = {}) {
  const item = await service.get(id, projectId);
  const conductor = process.env.CONDUCTOR_URL || process.env.CONDUCTOR_INTERNAL_BASE_URL;
  if (!conductor) {
    const note = 'CONDUCTOR_URL not set; recorded as queued';
    const updated = await service.update(id, projectId, { status: 'queued', url: item.url || '' });
    return { item: updated, status: 'queued', note };
  }
  const res = await proxy('POST', '/api/services/compute_manager/api/v1/tasks', {
    projectId,
    data: {
      project_id: projectId,
      name: `nb-${item.name}-${Date.now().toString(36)}`.slice(0, 64),
      image: body.image || item.image || 'alpine:3.19',
      command: body.command || item.command,
      run_mode: 'oneshot',
      env: body.env,
    },
  });
  if (res.status >= 400) {
    const note = res.data?.error?.message || `compute_manager ${res.status}`;
    const updated = await service.update(id, projectId, { status: 'queued' });
    return { item: updated, status: 'queued', note, compute_status: res.status };
  }
  const task = res.data?.item || res.data?.task || res.data;
  const updated = await service.update(id, projectId, {
    status: task?.status || 'running',
    url: task?.id ? String(task.id) : item.url,
  });
  return { item: updated, status: updated.status, task };
}

module.exports = { runNotebook };
