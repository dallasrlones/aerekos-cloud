'use strict';

/**
 * Schedule work from Neo4j ready-set respecting BEFORE / PARALLEL / MUTEX + priority.
 */

class SchedulerService {
  constructor({ graph, spawn, maxParallel = 3 } = {}) {
    this.graph = graph;
    this.spawn = spawn || (async () => {});
    this.maxParallel = maxParallel;
  }

  async tick(planId = null) {
    const ready = await this.graph.readySet(planId);
    const running = (this.graph.tasks
      ? [...this.graph.tasks.values()]
      : []).filter((t) => t.status === 'running');
    const slots = Math.max(0, this.maxParallel - running.length);
    const launched = [];

    // Group PARALLEL peers — launch together when all are ready
    const parallelGroups = new Map();
    if (this.graph.edges) {
      for (const e of this.graph.edges.filter((x) => x.type === 'PARALLEL')) {
        const key = [e.from, e.to].sort().join(':');
        if (!parallelGroups.has(key)) parallelGroups.set(key, new Set([e.from, e.to]));
        else {
          parallelGroups.get(key).add(e.from);
          parallelGroups.get(key).add(e.to);
        }
      }
    }

    const taken = new Set();
    for (const task of ready) {
      if (launched.length >= slots) break;
      if (taken.has(task.id)) continue;

      let batch = [task];
      for (const group of parallelGroups.values()) {
        if (group.has(task.id)) {
          batch = [...group].map((id) => ready.find((t) => t.id === id) || this.graph.tasks?.get(id))
            .filter(Boolean)
            .filter((t) => t.status === 'pending' || t.status === 'ready');
          break;
        }
      }

      for (const t of batch) {
        if (launched.length >= slots) break;
        if (taken.has(t.id)) continue;
        taken.add(t.id);
        await this.graph.setTaskStatus(t.id, 'running');
        await this.spawn(t);
        launched.push(t);
      }
    }

    return { ready: ready.length, launched: launched.map((t) => t.id), slots };
  }
}

module.exports = { SchedulerService };
