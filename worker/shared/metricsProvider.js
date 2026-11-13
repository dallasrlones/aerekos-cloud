'use strict';

/**
 * Metrics seam (W6). Production: Prometheus scrape; SQLite samples = dev only.
 */

function safeName(name) {
  return (
    String(name || 'app')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase() || 'app'
  );
}

function escapeLabel(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\n/g, ' ').replace(/"/g, '\\"');
}

class LocalPrometheusProvider {
  /**
   * @param {{ serviceName: string, metricBase?: string }} opts
   */
  constructor({ serviceName, metricBase = 'http_requests_total' } = {}) {
    if (!serviceName) throw new Error('LocalPrometheusProvider: serviceName is required');
    this.serviceName = serviceName;
    this.metricBase = metricBase;
    this.prefix = `aerekos_${safeName(serviceName)}`;
    /** @type {Map<string, number>} */
    this.counters = new Map();
  }

  describe() {
    return {
      backend: 'prometheus_text',
      implemented: true,
      future: 'Prometheus remote-write / managed AMP / Grafana Cloud',
    };
  }

  observeHttp(method, statusCode) {
    const m = String(method || 'UNKNOWN');
    const c = String(statusCode);
    const k = `${m}|${c}`;
    this.counters.set(k, (this.counters.get(k) || 0) + 1);
  }

  setGauge(_name, _value, _labels) {
    // Gauges reserved for future recording rules adapter.
  }

  renderText() {
    const lines = [];
    const metric = `${this.prefix}_${this.metricBase}`;
    lines.push(`# HELP ${metric} HTTP requests (exposition format 0.0.4)`);
    lines.push(`# TYPE ${metric} counter`);
    for (const [k, v] of this.counters) {
      const [method, code] = k.split('|');
      lines.push(
        `${metric}{method="${escapeLabel(method)}",code="${escapeLabel(code)}"} ${v}`
      );
    }
    return `${lines.join('\n')}\n`;
  }
}

function createMetricsProvider(kind, opts) {
  const resolved = String(kind || process.env.AEREKOS_METRICS_PROVIDER || 'prometheus_text').toLowerCase();
  if (resolved === 'prometheus_text' || resolved === 'local') {
    return new LocalPrometheusProvider(opts);
  }
  const e = new Error(`metrics provider "${resolved}" is not implemented`);
  e.code = 'MetricsProviderNotImplemented';
  e.status = 501;
  throw e;
}

module.exports = {
  LocalPrometheusProvider,
  createMetricsProvider,
  safeName,
  escapeLabel,
};
