'use strict';

const { TaskService } = require('./TaskService');
const { DockerService } = require('./DockerService');
const { proxy } = require('../../../shared/conductorProxy');

function lineLevel(line) {
  const s = String(line || '');
  if (/\b(error|fatal|exception|panic)\b/i.test(s)) return 'error';
  if (/\bwarn(ing)?\b/i.test(s)) return 'warn';
  if (/\bdebug\b/i.test(s)) return 'debug';
  return 'info';
}

/**
 * Ship project-task Docker logs → logs_manager and stats → metrics_manager.
 * Resumes on boot for every running task. Skips host aerekos-* inventory.
 */
class ObserveShipper {
  constructor(deps = {}) {
    this.tasks = deps.tasks || new TaskService();
    this.docker = deps.docker || this.tasks.docker || new DockerService();
    this.lastTs = new Map();
    this.timer = null;
    this.busy = false;
    this.quietUntil = 0;
  }

  start() {
    if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_OBSERVE === '1') return;
    this.tick().catch((e) => console.warn('[observe] first tick', e.message));
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.warn('[observe]', e.message));
    }, Number(process.env.OBSERVE_INTERVAL_MS || 15000));
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  backoff(ms = 60000) {
    this.quietUntil = Date.now() + ms;
  }

  async tick() {
    if (this.busy || Date.now() < this.quietUntil) return;
    this.busy = true;
    try {
    const rows = await this.tasks.listRunning();
    for (const row of rows) {
      if (!row.container_id || row.container_id === 'mock-container-id') continue;
      await this.shipLogs(row).catch((e) => {
        console.warn('[observe] logs', row.id, e.message);
        if (/timeout|ECONN|401|503/i.test(e.message || '')) this.backoff();
      });
      await this.shipMetrics(row).catch((e) => {
        console.warn('[observe] metrics', row.id, e.message);
        if (/timeout|ECONN|401|503/i.test(e.message || '')) this.backoff();
      });
    }
    } finally {
      this.busy = false;
    }
  }

  async shipLogs(row) {
    const since = this.lastTs.get(row.id);
    const text = await this.docker.logs(row.container_id, {
      tail: since ? 200 : 80,
      since: since ? Math.floor(since / 1000) : undefined,
    });
    const lines = String(text || '')
      .split('\n')
      .map((l) => l.replace(/^\x1b\[[0-9;]*m/g, '').trim())
      .filter(Boolean);
    if (!lines.length) return;
    const entries = [];
    let newest = since || 0;
    for (const line of lines) {
      const m = line.match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+(.*)$/);
      const ts = m ? Date.parse(m[1]) : Date.now();
      const message = (m ? m[2] : line).slice(0, 8000);
      if (since && ts && ts <= since) continue;
      if (ts > newest) newest = ts;
      entries.push({
        level: lineLevel(message),
        source: `compute.${row.id}`,
        message,
        context: { task_id: row.id, container_id: row.container_id, stream: 'stdio' },
      });
    }
    if (newest) this.lastTs.set(row.id, newest);
    if (!entries.length) return;
    const res = await proxy({
      service: 'logs_manager',
      method: 'POST',
      path: '/api/v1/logs/batch',
      projectId: row.project_id,
      body: { project_id: row.project_id, entries: entries.slice(0, 200) },
      timeout: 3000,
    });
    if (res.status >= 400) {
      console.warn('[observe] logs_manager', res.status, res.data?.error || '');
      if (res.status === 401 || res.status === 503 || res.status === 404) this.backoff();
    }
  }

  async shipMetrics(row) {
    const snap = await this.docker.stats(row.container_id);
    const ts = Date.now();
    const labels = JSON.stringify({ task_id: row.id, container_id: String(row.container_id).slice(0, 12) });
    for (const [metric_name, value] of [
      ['compute.cpu_percent', snap.cpu_percent],
      ['compute.memory_bytes', snap.memory_bytes],
    ]) {
      const res = await proxy({
        service: 'metrics_manager',
        method: 'POST',
        path: '/api/v1/series',
        projectId: row.project_id,
        body: {
          project_id: row.project_id,
          name: `${metric_name}/${row.id}/${ts}`,
          metric_name,
          value: String(value),
          labels,
        },
          timeout: 3000,
        });
      if (res.status >= 400) {
        console.warn('[observe] metrics_manager', res.status, res.data?.error || '');
        if (res.status === 401 || res.status === 503 || res.status === 404) this.backoff();
      }
    }
  }
}

module.exports = { ObserveShipper };
