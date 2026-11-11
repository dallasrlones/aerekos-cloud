'use strict';

/**
 * Live Icarus score strip: run a fast subset of the control-plane bench and
 * broadcast ai:icarus.bench for the Agents UI.
 */

const { run } = require('./IcarusBenchmark');
const { emitIcarusBench } = require('../utils/aiLive');

const DEFAULT_MS = 15 * 60 * 1000;

class IcarusLiveBenchService {
  constructor() {
    this._timers = new Map(); // projectId -> interval
    this._last = new Map(); // projectId -> report
  }

  last(projectId) {
    return this._last.get(String(projectId)) || null;
  }

  async runOnce(projectId, { hard = false, emit = true } = {}) {
    const pid = String(projectId || 'live-bench');
    const t0 = Date.now();
    const report = await run({ hard: !!hard });
    const payload = {
      project_id: pid,
      grade: report.scorecard?.grade,
      pass: report.pass,
      hard: !!hard,
      scorecard: report.scorecard,
      quality: report.quality,
      wall_ms: Date.now() - t0,
      at: Date.now(),
    };
    this._last.set(pid, payload);
    if (emit) emitIcarusBench(payload, pid);
    return payload;
  }

  start(projectId, { intervalMs } = {}) {
    const pid = String(projectId || '');
    if (!pid) return { ok: false, error: 'project_id required' };
    this.stop(pid);
    const ms = Number(intervalMs || process.env.ICARUS_LIVE_BENCH_MS || DEFAULT_MS) || DEFAULT_MS;
    const tick = () => {
      this.runOnce(pid, { hard: process.env.ICARUS_BENCH_HARD === '1' }).catch(() => {});
    };
    tick();
    const timer = setInterval(tick, ms);
    if (typeof timer.unref === 'function') timer.unref();
    this._timers.set(pid, timer);
    return { ok: true, interval_ms: ms, project_id: pid };
  }

  stop(projectId) {
    const pid = String(projectId || '');
    const t = this._timers.get(pid);
    if (t) clearInterval(t);
    this._timers.delete(pid);
    return { ok: true, stopped: pid };
  }
}

const liveBench = new IcarusLiveBenchService();

module.exports = { IcarusLiveBenchService, liveBench };
