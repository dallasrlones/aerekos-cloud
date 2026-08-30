'use strict';

/**
 * Health watchdog: probe /health on running manager containers and restart after
 * N consecutive failures. Caps restarts to avoid thrash. SKIP_HEAL=1 disables.
 *
 * Tests inject `probe` and `restart` fakes.
 */
const DEFAULTS = {
  failThreshold: 3,
  maxRestarts: 3,
  windowMs: 10 * 60 * 1000,
};

class HealthWatchdog {
  constructor({ probe, restart, now, failThreshold, maxRestarts, windowMs, onEvent } = {}) {
    this.probe = probe;
    this.restart = restart;
    this.now = now || (() => Date.now());
    this.failThreshold = failThreshold || DEFAULTS.failThreshold;
    this.maxRestarts = maxRestarts || DEFAULTS.maxRestarts;
    this.windowMs = windowMs || DEFAULTS.windowMs;
    this.onEvent = onEvent || (() => {});
    this.failures = new Map(); // key -> count
    this.restarts = new Map(); // key -> timestamps[]
    this.degraded = new Set();
  }

  _key(service, projectId) {
    return `${service}:${projectId || ''}`;
  }

  skipped() {
    return process.env.SKIP_HEAL === '1' || process.env.SKIP_HEAL === 'true';
  }

  async tick(targets) {
    if (this.skipped()) return { skipped: true, actions: [] };
    const actions = [];
    for (const t of targets || []) {
      const key = this._key(t.service, t.projectId);
      if (this.degraded.has(key)) {
        actions.push({ service: t.service, action: 'degraded' });
        continue;
      }
      let ok = false;
      try {
        ok = await this.probe(t);
      } catch {
        ok = false;
      }
      if (ok) {
        const wasFailing = (this.failures.get(key) || 0) > 0;
        this.failures.set(key, 0);
        if (wasFailing) {
          this.onEvent('service:recovered', t);
          actions.push({ service: t.service, action: 'recovered' });
        }
        continue;
      }
      const n = (this.failures.get(key) || 0) + 1;
      this.failures.set(key, n);
      if (n < this.failThreshold) {
        actions.push({ service: t.service, action: 'fail', consecutive: n });
        continue;
      }
      const stamp = this.now();
      const hist = (this.restarts.get(key) || []).filter((ts) => stamp - ts < this.windowMs);
      if (hist.length >= this.maxRestarts) {
        this.degraded.add(key);
        this.onEvent('service:degraded', t);
        actions.push({ service: t.service, action: 'degraded' });
        continue;
      }
      try {
        await this.restart(t);
        hist.push(stamp);
        this.restarts.set(key, hist);
        this.failures.set(key, 0);
        this.onEvent('service:unhealthy', t);
        actions.push({ service: t.service, action: 'restarted' });
      } catch (err) {
        actions.push({ service: t.service, action: 'restart_failed', error: err.message });
      }
    }
    return { skipped: false, actions };
  }
}

module.exports = { HealthWatchdog, DEFAULTS };
