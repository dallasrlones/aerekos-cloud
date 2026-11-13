'use strict';

/**
 * Liveness / readiness / metrics stubs for managers that do not use createManagerApp.
 * createManagerApp already registers /health and /ready; call registerManagerProbes only
 * on custom Express apps to avoid duplicate routes.
 */

function registerManagerProbes(
  app,
  { serviceName, db, metrics = false, setupPrometheus } = {}
) {
  if (!app || typeof app.get !== 'function') {
    throw new Error('registerManagerProbes: app is required');
  }
  const name = () =>
    process.env.SERVICE_NAME || serviceName || process.env.npm_package_name || 'manager';

  app.get('/health', async (req, res) => {
    try {
      if (db && typeof db.healthCheck === 'function') {
        const health = await db.healthCheck();
        if (!health.healthy) {
          return res.status(503).json({
            status: 'unhealthy',
            service: name(),
            error: health.error || 'Database check failed',
            timestamp: new Date().toISOString(),
          });
        }
      }
      res.status(200).json({
        status: 'healthy',
        service: name(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: name(),
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/ready', async (req, res) => {
    try {
      if (db && typeof db.healthCheck === 'function') {
        const health = await db.healthCheck();
        if (!health.healthy) {
          return res.status(503).json({
            status: 'not ready',
            service: name(),
            error: health.error || 'Database not available',
          });
        }
      }
      res.status(200).json({ status: 'ready', service: name() });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });

  if (metrics) {
    const setup = setupPrometheus || require('./simplePrometheusMetrics').setupPrometheus;
    setup(app, { serviceName: name() });
  }
}

module.exports = { registerManagerProbes };
