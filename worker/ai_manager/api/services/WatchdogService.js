'use strict';

/**
 * Anti-deadlock watchdog: stall detection, MUTEX timeout, regroup on INVALIDATES.
 */

const DEFAULTS = {
  stallMs: 120_000,
  mutexMs: 300_000,
  tickMs: 15_000,
};

class WatchdogService {
  constructor({ graph, onRegroup, onNudge, options = {} } = {}) {
    this.graph = graph;
    this.onRegroup = onRegroup || (async () => {});
    this.onNudge = onNudge || (async () => {});
    this.opts = { ...DEFAULTS, ...options };
    this._timer = null;
    this._lastProgress = new Map(); // taskId -> ts
  }

  markProgress(taskId) {
    this._lastProgress.set(String(taskId), Date.now());
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      this.tick().catch(() => {});
    }, this.opts.tickMs);
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async tick() {
    if (!this.graph?.readySet) return { stalled: [], regroup: [] };
    const ready = await this.graph.readySet();
    const now = Date.now();
    const stalled = [];
    const tasks = this.graph.tasks
      ? [...this.graph.tasks.values()]
      : ready;

    for (const t of tasks) {
      if (t.status !== 'running') continue;
      const last = this._lastProgress.get(t.id) || t.updated_at || t.created_at || now;
      if (now - last > this.opts.stallMs) {
        stalled.push(t);
        await this.onNudge({
          type: 'stall', task: t, idle_ms: now - last,
        });
      }
    }

    // Propagate invalidated → regroup children
    const regroup = [];
    if (this.graph.edges) {
      for (const e of this.graph.edges) {
        if (e.type !== 'INVALIDATES') continue;
        const victim = this.graph.tasks.get(e.to);
        if (victim && victim.status === 'invalidated') {
          regroup.push(victim);
          await this.onRegroup({ reason: 'invalidates', task: victim });
        }
      }
    }

    return { stalled, regroup, ready_count: ready.length, at: now };
  }
}

module.exports = { WatchdogService, DEFAULTS };
