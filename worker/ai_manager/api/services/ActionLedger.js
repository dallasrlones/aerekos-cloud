'use strict';

const { randomUUID } = require('crypto');

/**
 * Undo/diff + artifact replay ledger. Every mutating agent action appends a row.
 */

class ActionLedger {
  constructor() {
    this.rows = []; // newest last
  }

  append({
    projectId, agentId, lane, tool, args, before, after, reversible = false,
    taskId, workerId, ok,
  }) {
    const row = {
      id: randomUUID(),
      project_id: projectId,
      agent_id: agentId || '',
      lane: lane || '',
      tool: tool || '',
      args: args || {},
      before: before ?? null,
      after: after ?? null,
      reversible: Boolean(reversible),
      undone: false,
      task_id: taskId || args?.task_id || '',
      worker_id: workerId || args?.worker_id || '',
      ok: ok != null ? Boolean(ok) : true,
      created_at: Date.now(),
    };
    this.rows.push(row);
    try {
      const { emitIcarusTool } = require('../utils/aiLive');
      emitIcarusTool({
        id: row.id,
        task_id: row.task_id,
        worker_id: row.worker_id,
        agent_id: row.agent_id,
        tool: row.tool,
        ok: row.ok,
        summary: summarizeTool(row),
        args: row.args,
      }, projectId);
    } catch { /* */ }
    return row;
  }

  list(projectId, { limit = 50, taskId } = {}) {
    let rows = this.rows.filter((r) => r.project_id === projectId);
    if (taskId) rows = rows.filter((r) => r.task_id === taskId || r.args?.task_id === taskId);
    return rows.slice(-limit).reverse();
  }

  get(id) {
    return this.rows.find((r) => r.id === id) || null;
  }

  markUndone(id) {
    const r = this.get(id);
    if (!r || !r.reversible || r.undone) return null;
    r.undone = true;
    r.undone_at = Date.now();
    return r;
  }

  diff(id) {
    const r = this.get(id);
    if (!r) return null;
    return {
      id: r.id,
      tool: r.tool,
      before: r.before,
      after: r.after,
      reversible: r.reversible,
      undone: r.undone,
    };
  }
}

function summarizeTool(row) {
  const a = row.args || {};
  const bits = [row.tool];
  if (a.path) bits.push(String(a.path).slice(0, 60));
  if (a.title) bits.push(String(a.title).slice(0, 40));
  if (row.ok === false) bits.push('FAIL');
  return bits.join(' · ');
}

const ledger = new ActionLedger();

module.exports = { ActionLedger, ledger, summarizeTool };
