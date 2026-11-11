'use strict';

const { liveEmitSoon } = require('../../../shared/liveEmit');

let lastPullAt = 0;
let lastPullKey = '';
let lastPullPct = -1;
let lastTokenAt = 0;

function roomFor(projectId) {
  const pid = String(projectId || '').trim();
  return pid ? `ai:live:${pid}` : 'ai:live';
}

function emitPull(pull, projectId, force) {
  if (!pull || !pull.model) return;
  const now = Date.now();
  const pct = Number(pull.percent) || 0;
  const terminal = pull.status === 'success' || pull.status === 'error';
  if (
    !force
    && !terminal
    && lastPullKey === pull.model
    && now - lastPullAt < 400
    && Math.abs(pct - lastPullPct) < 2
  ) {
    return;
  }
  lastPullAt = now;
  lastPullKey = pull.model;
  lastPullPct = pct;
  liveEmitSoon(roomFor(projectId), 'ai:pull', { pull, project_id: projectId || '' });
}

function emitBench(run, projectId) {
  if (!run) return;
  liveEmitSoon(roomFor(projectId), 'ai:bench', { run, project_id: projectId || '' });
}

function emitJob(job, projectId) {
  if (!job) return;
  liveEmitSoon(roomFor(projectId), 'ai:job', { job, job_id: job.id, status: job.status, project_id: projectId || '' });
}

function emitJobToken(payload, projectId) {
  if (!payload) return;
  const now = Date.now();
  if (now - lastTokenAt < 50 && !payload.flush) return;
  lastTokenAt = now;
  liveEmitSoon(roomFor(projectId), 'ai:job.token', { ...payload, project_id: projectId || '' });
}

function emitAgentPulse(pulse, projectId) {
  if (!pulse) return;
  liveEmitSoon(roomFor(projectId), 'ai:agent.pulse', { pulse, project_id: projectId || '' });
}

function emitAgentAsk(ask, projectId) {
  if (!ask) return;
  liveEmitSoon(roomFor(projectId), 'ai:agent.ask', { ask, project_id: projectId || '' });
}

function emitAgentAskAnswered(ask, projectId) {
  if (!ask) return;
  liveEmitSoon(roomFor(projectId), 'ai:agent.ask.answered', { ask, project_id: projectId || '' });
}

function emitAgentDone(payload, projectId) {
  if (!payload) return;
  liveEmitSoon(roomFor(projectId), 'ai:agent.done', { ...payload, project_id: projectId || '' });
}

/** Coalesce graph broadcasts (~100ms) per project+plan. */
const graphPending = new Map();

function emitIcarusGraph(subgraph, projectId, { force = false } = {}) {
  if (!subgraph) return;
  const pid = String(projectId || '');
  const planId = subgraph.plan?.id || subgraph.plan_id || '';
  const key = `${pid}:${planId}`;
  if (force) {
    liveEmitSoon(roomFor(pid), 'ai:icarus.graph', {
      ...subgraph, plan_id: planId, project_id: pid, at: Date.now(),
    });
    return;
  }
  graphPending.set(key, subgraph);
  if (graphPending.has(`${key}:timer`)) return;
  graphPending.set(`${key}:timer`, true);
  setTimeout(() => {
    graphPending.delete(`${key}:timer`);
    const payload = graphPending.get(key);
    graphPending.delete(key);
    if (!payload) return;
    liveEmitSoon(roomFor(pid), 'ai:icarus.graph', {
      ...payload, plan_id: planId, project_id: pid, at: Date.now(),
    });
  }, 100);
}

function emitIcarusTask(task, projectId) {
  if (!task) return;
  liveEmitSoon(roomFor(projectId), 'ai:icarus.task', {
    task,
    task_id: task.id || task.task_id,
    status: task.status,
    agent_id: task.agent_id || '',
    title: task.title || '',
    plan_id: task.plan_id || '',
    project_id: projectId || '',
    at: Date.now(),
  });
}

function emitIcarusTool(payload, projectId) {
  if (!payload) return;
  liveEmitSoon(roomFor(projectId), 'ai:icarus.tool', {
    ...payload,
    project_id: projectId || '',
    at: Date.now(),
  });
}

module.exports = {
  emitPull,
  emitBench,
  emitJob,
  emitJobToken,
  emitAgentPulse,
  emitAgentAsk,
  emitAgentAskAnswered,
  emitAgentDone,
  emitIcarusGraph,
  emitIcarusTask,
  emitIcarusTool,
};
