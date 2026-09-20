'use strict';

function applyJobEvent(jobs, payload, projectId, limit = 20) {
  const list = Array.isArray(jobs) ? jobs : [];
  const pid = projectId || '';
  const eventPid = payload?.project_id || payload?.job?.project_id || '';
  if (pid && eventPid && eventPid !== pid) return list;
  const job = payload?.job;
  if (!job?.id) return list;
  if (payload?.action === 'deleted') {
    return list.filter((j) => j.id !== job.id);
  }
  return [job, ...list.filter((j) => j.id !== job.id)].slice(0, Math.min(Number(limit) || 20, 100));
}

module.exports = { applyJobEvent };
