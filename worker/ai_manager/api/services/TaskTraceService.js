'use strict';

/**
 * Bootstrap inspector: messages + ledger tools + decisions for one task.
 */

async function taskTrace(facade, taskId, { agents, projectId, agentId } = {}) {
  const task = facade.graph ? await facade.graph.getTask(taskId) : null;
  const tools = facade.ledger.list(projectId || facade.projectId, {
    limit: 100, taskId,
  });
  let decisions = [];
  if (facade.graph?.decisions) {
    decisions = facade.graph.decisions.filter(
      (d) => d.taskId === taskId || d.task_id === taskId,
    );
  }
  let why = null;
  try {
    why = await facade.explain.whyTask(projectId || facade.projectId, taskId);
  } catch { /* */ }

  let messages = [];
  let timeline = [];
  if (agents && (agentId || task?.agent_id)) {
    const aid = agentId || task.agent_id;
    try {
      if (typeof agents.listMessages === 'function') {
        const all = await agents.listMessages(projectId || facade.projectId, aid, { limit: 200 });
        messages = (all || []).filter((m) => {
          const meta = typeof m.meta === 'string' ? safe(m.meta) : (m.meta || {});
          return m.task_id === taskId
            || meta.task_id === taskId
            || (m.content && String(m.content).includes(`task:${taskId}`));
        });
      }
    } catch { /* */ }
    try {
      if (typeof agents.listTimeline === 'function') {
        const tl = await agents.listTimeline(projectId || facade.projectId, aid);
        timeline = (tl || []).filter((row) => {
          const meta = typeof row.meta === 'string' ? safe(row.meta) : (row.meta || {});
          return row.task_id === taskId || meta.task_id === taskId;
        });
      }
    } catch { /* */ }
  }

  return {
    task,
    messages,
    tools,
    timeline,
    decisions,
    why,
    at: Date.now(),
  };
}

function safe(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}

/** Replay subgraph statuses as of a scrub timestamp (memory store history). */
function scrubSubgraph(subgraph, atMs) {
  if (!subgraph || atMs == null) return subgraph;
  const tasks = (subgraph.tasks || []).map((t) => {
    const hist = t.status_history || [];
    if (!hist.length) return t;
    // Same-ms updates: take the last entry with at <= atMs (stable scrub).
    let status = hist[0].status;
    for (const h of hist) {
      if (h.at <= atMs) status = h.status;
    }
    return { ...t, status, scrubbed_at: atMs };
  });
  return { ...subgraph, tasks, scrubbed_at: atMs };
}

module.exports = { taskTrace, scrubSubgraph };
