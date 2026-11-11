'use strict';

/**
 * Overnight Jarvis loop: recursive bench → optional fix hint → report.
 * Does not touch the production project UUID.
 */

const { liveBench } = require('./IcarusLiveBenchService');
const { emitIcarusBench } = require('../utils/aiLive');
const { ledger } = require('./ActionLedger');

const FORBIDDEN = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
const DEFAULT_MS = 60 * 60 * 1000; // hourly overnight

class IcarusNightlyService {
  constructor() {
    this._timer = null;
    this._reports = [];
    this.projectId = '';
  }

  list() {
    return this._reports.slice(-48);
  }

  async cycle(projectId, { hard = true } = {}) {
    const pid = String(projectId || this.projectId || '');
    if (!pid || pid === FORBIDDEN) {
      return { ok: false, error: 'refuses prod UUID / missing project' };
    }
    const bench = await liveBench.runOnce(pid, { hard, emit: true });
    const report = {
      id: `night-${Date.now().toString(36)}`,
      project_id: pid,
      at: Date.now(),
      pass: !!bench.pass,
      grade: bench.grade,
      wall_ms: bench.wall_ms,
      fix_hint: bench.pass
        ? null
        : 'Re-run ICARUS_BENCH_HARD=1 npm run bench:icarus:hard; inspect failing SLO rows; keep gate/gateway soft-reserve.',
      scorecard: bench.scorecard,
    };
    this._reports.push(report);
    while (this._reports.length > 48) this._reports.shift();
    ledger.append({
      projectId: pid,
      lane: 'safety',
      tool: 'nightly_bench',
      args: { hard, grade: report.grade },
      after: { pass: report.pass, wall_ms: report.wall_ms },
      reversible: false,
    });
    emitIcarusBench({ ...bench, nightly: true, fix_hint: report.fix_hint }, pid);
    return report;
  }

  start(projectId, { intervalMs } = {}) {
    const pid = String(projectId || '');
    if (!pid || pid === FORBIDDEN) return { ok: false, error: 'bad project' };
    this.stop();
    this.projectId = pid;
    const ms = Number(intervalMs || process.env.ICARUS_NIGHTLY_MS || DEFAULT_MS) || DEFAULT_MS;
    const tick = () => {
      this.cycle(pid, { hard: true }).catch(() => {});
    };
    tick();
    this._timer = setInterval(tick, ms);
    if (typeof this._timer.unref === 'function') this._timer.unref();
    return { ok: true, interval_ms: ms, project_id: pid };
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    return { ok: true };
  }
}

const nightly = new IcarusNightlyService();

module.exports = { IcarusNightlyService, nightly, FORBIDDEN };
