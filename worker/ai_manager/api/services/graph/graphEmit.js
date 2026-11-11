'use strict';

/**
 * Broadcast plan-graph mutations to the project live room.
 */

function emitTaskAndGraph(graph, task) {
  if (!graph || !task) return;
  try {
    const {
      emitIcarusTask, emitIcarusGraph,
    } = require('../../utils/aiLive');
    const projectId = graph.projectId || task.project_id;
    emitIcarusTask(task, projectId);
    const planId = task.plan_id;
    if (planId && typeof graph.subgraph === 'function') {
      Promise.resolve(graph.subgraph(planId)).then((sub) => {
        emitIcarusGraph(sub, projectId);
      }).catch(() => {});
    }
  } catch { /* live bus optional in unit tests */ }
}

module.exports = { emitTaskAndGraph };
