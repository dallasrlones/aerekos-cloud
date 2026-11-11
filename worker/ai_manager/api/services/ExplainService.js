'use strict';

/**
 * Phase 8 — explain-why: reconstruct decision rationale from graph + ledger.
 */

class ExplainService {
  constructor({ graph, ledger } = {}) {
    this.graph = graph;
    this.ledger = ledger;
  }

  async whyTask(projectId, taskId) {
    const task = this.graph ? await this.graph.getTask(taskId) : null;
    const decisions = this.graph?.decisions
      ? this.graph.decisions.filter((d) => d.taskId === taskId || d.task_id === taskId)
      : [];
    const actions = this.ledger
      ? this.ledger.list(projectId, { limit: 100 }).filter((a) => a.args?.task_id === taskId
        || a.after?.task_id === taskId)
      : [];

    return {
      task,
      why: decisions.map((d) => d.why || d).filter(Boolean),
      decisions,
      actions: actions.slice(0, 20),
      summary: task
        ? `Task "${task.title}" is ${task.status}${task.agent_id ? ` on agent ${task.agent_id}` : ''}.`
        : 'Task not found',
    };
  }

  async whyDecision(decisionId) {
    if (!this.graph?.decisions) return null;
    return this.graph.decisions.find((d) => d.id === decisionId) || null;
  }
}

module.exports = { ExplainService };
