'use strict';

/**
 * Minimal Prometheus text exposition: HTTP request counter + GET /metrics.
 * No prom-client (avoids optional native/OpenTelemetry peer deps in mixed installs).
 */

function safeServiceName(name) {
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

function setupPrometheus(
  app,
  { serviceName, skipPaths = ['/metrics', '/health', '/ready'] } = {}
) {
  if (!serviceName) {
    throw new Error('setupPrometheus: serviceName is required');
  }
  const pfx = `aerekos_${safeServiceName(serviceName)}`;
  const counts = new Map();

  app.use((req, res, next) => {
    const path = req.path || '';
    if (skipPaths.some((s) => path === s || path.startsWith(`${s}/`))) {
      return next();
    }
    res.on('finish', () => {
      const m = req.method || 'UNKNOWN';
      const c = String(res.statusCode);
      const k = `${m}|${c}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    next();
  });

  app.get('/metrics', (req, res) => {
    const lines = [];
    lines.push(
      `# HELP ${pfx}_http_requests_total Total HTTP requests (health/metrics/ready excluded from counting)`
    );
    lines.push(`# TYPE ${pfx}_http_requests_total counter`);
    for (const [k, v] of counts) {
      const [method, code] = k.split('|');
      lines.push(
        `${pfx}_http_requests_total{method="${escapeLabel(method)}",code="${escapeLabel(
          code
        )}"} ${v}`
      );
    }
    res.type('text/plain; version=0.0.4; charset=utf-8');
    res.send(`${lines.join('\n')}\n`);
  });
}

module.exports = { setupPrometheus };
