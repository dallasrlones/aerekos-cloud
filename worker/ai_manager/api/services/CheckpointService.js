'use strict';

/**
 * Time-travel checkpoints over plan graph + optional workspace tip.
 */

class CheckpointService {
  constructor({ graph } = {}) {
    this.graph = graph;
    this.local = new Map(); // projectId -> checkpoints[]
  }

  async save(projectId, { planId, label, snapshot } = {}) {
    let id;
    if (this.graph?.createCheckpoint && planId) {
      const r = await this.graph.createCheckpoint({ planId, label, snapshot });
      id = r.id;
    } else {
      id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    const row = {
      id,
      project_id: projectId,
      plan_id: planId || '',
      label: label || 'checkpoint',
      snapshot: snapshot || {},
      created_at: Date.now(),
    };
    if (!this.local.has(projectId)) this.local.set(projectId, []);
    this.local.get(projectId).push(row);
    return row;
  }

  list(projectId) {
    return (this.local.get(projectId) || []).slice().reverse();
  }

  get(projectId, id) {
    return (this.local.get(projectId) || []).find((c) => c.id === id) || null;
  }

  /**
   * Restore returns the snapshot for the runtime to apply (graph status rewrite).
   */
  async restore(projectId, id) {
    const cp = this.get(projectId, id);
    if (!cp) return null;
    if (cp.snapshot?.tasks && this.graph?.setTaskStatus) {
      for (const t of cp.snapshot.tasks) {
        if (t.id && t.status) await this.graph.setTaskStatus(t.id, t.status);
      }
    }
    return cp;
  }
}

module.exports = { CheckpointService };
