'use strict';

function applyPullEvent(pulls, payload) {
  const pull = payload?.pull;
  if (!pull?.model) return Array.isArray(pulls) ? pulls : [];
  return [pull, ...(pulls || []).filter((p) => p.model !== pull.model)];
}

function applyBenchEvent(benchData, payload) {
  const run = payload?.run;
  if (!run) return benchData;
  return benchData ? { ...benchData, run } : { run, items: [], pending: [], pending_count: 0 };
}

function applyLogAppend(rows, payload, { source, projectId, limit = 400 } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (projectId && payload?.project_id && payload.project_id !== projectId) return list;
  if (source && payload?.source && payload.source !== source) return list;
  const incoming = Array.isArray(payload?.logs) ? payload.logs : [];
  if (!incoming.length) return list;
  return [...list, ...incoming].slice(-Math.min(Number(limit) || 400, 2000));
}

module.exports = { applyPullEvent, applyBenchEvent, applyLogAppend };
