const axios = require('axios');

const LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal']);

/**
 * Periodically POSTs pending outbox rows to conductor:
 *   POST {conductorBase}/api/services/logs_manager/api/v1/logs/batch
 * with Authorization: Bearer <token> (user JWT or a conductor-registered service token).
 */
class LogShipper {
  constructor({
    outbox,
    conductorBaseUrl,
    bearerToken,
    intervalMs = 5000,
    batchSize = 80,
    axiosInstance = null
  }) {
    this.outbox = outbox;
    this.conductorBaseUrl = conductorBaseUrl.replace(/\/$/, '');
    this.bearerToken = bearerToken;
    this.intervalMs = intervalMs;
    this.batchSize = batchSize;
    this.http = axiosInstance || axios;
    this.timer = null;
    this.inFlight = false;
  }

  buildUrl() {
    return `${this.conductorBaseUrl}/api/services/logs_manager/api/v1/logs/batch`;
  }

  rowToEntry(row) {
    const level = LEVELS.has(String(row.level).toLowerCase())
      ? String(row.level).toLowerCase()
      : 'info';
    let context;
    if (row.context_json) {
      try {
        context = JSON.parse(row.context_json);
      } catch {
        context = { _raw: String(row.context_json).slice(0, 2000) };
      }
    }
    return {
      level,
      source: row.source || 'unknown',
      message: row.message,
      ...(context !== undefined ? { context } : {})
    };
  }

  async flushOnce() {
    if (this.inFlight) {
      return;
    }
    this.inFlight = true;
    try {
      const rows = this.outbox.takeBatch(this.batchSize);
      if (!rows.length) {
        return;
      }
      const byProject = new Map();
      for (const r of rows) {
        const pid = r.project_id;
        if (!byProject.has(pid)) {
          byProject.set(pid, []);
        }
        byProject.get(pid).push(r);
      }
      for (const [projectId, group] of byProject) {
        const entries = group.map((row) => this.rowToEntry(row));
        const ids = group.map((r) => r.id);
        try {
          const res = await this.http.post(
            this.buildUrl(),
            { project_id: projectId, entries },
            {
              headers: {
                Authorization: `Bearer ${this.bearerToken}`,
                'Content-Type': 'application/json'
              },
              timeout: 60000,
              validateStatus: () => true
            }
          );
          if (res.status === 201 || res.status === 200) {
            this.outbox.removeIds(ids);
          } else {
            const msg = res.data?.error?.message || `HTTP ${res.status}`;
            for (const row of group) {
              this.outbox.bumpFailure(row.id, String(msg));
            }
          }
        } catch (e) {
          for (const row of group) {
            this.outbox.bumpFailure(row.id, e.message);
          }
        }
      }
    } finally {
      this.inFlight = false;
    }
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.flushOnce().catch((e) => {
        console.error('[LogShipper] flush error', e.message);
      });
    }, this.intervalMs);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = { LogShipper };
