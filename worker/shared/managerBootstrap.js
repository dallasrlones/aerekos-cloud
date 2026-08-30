'use strict';

/**
 * Shared Express bootstrap for first-party managers.
 * Express is loaded only when createManagerApp runs (from /app/<manager>, which has node_modules).
 */
const { projectId: coreProjectId } = require('./crudCore');
const { assertNoSkipFakes } = require('./prodGuards');

function projectId(req) {
  return coreProjectId(req) || null;
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || 'Internal server error',
      status,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  });
}

function createManagerApp({
  serviceName,
  defaultPort,
  db,
  extraSetup,
  ensureDefaults,
  register,
} = {}) {
  if (!serviceName) throw new Error('createManagerApp: serviceName is required');
  assertNoSkipFakes();
  const path = require('path');
  const fromApp = (mod) => {
    try { return require(mod); } catch {
      return require(path.join(process.cwd(), 'node_modules', mod));
    }
  };
  const express = fromApp('express');
  const cors = fromApp('cors');
  const { setupPrometheus } = require('./simplePrometheusMetrics');
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  setupPrometheus(app, { serviceName });

  const name = () => process.env.SERVICE_NAME || serviceName;

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
      res.status(200).json({ status: 'healthy', service: name(), timestamp: new Date().toISOString() });
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

  app.post('/api/v1/ensure-defaults', async (req, res, next) => {
    try {
      const pid = projectId(req);
      if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
      if (typeof ensureDefaults !== 'function') {
        return res.json({ ok: true, defaults: {}, skipped: true });
      }
      const defaults = await ensureDefaults(pid, req.body || {});
      res.json({ ok: true, defaults: defaults || {} });
    } catch (err) {
      next(err);
    }
  });

  if (typeof extraSetup === 'function') extraSetup(app);

  app.use(errorHandler);

  function listen(onListen) {
    const PORT = parseInt(process.env.PORT || String(defaultPort || 0), 10);
    const server = app.listen(PORT, async () => {
      console.log(`[${serviceName}] listening on ${PORT}`);
      if (typeof onListen === 'function') {
        try {
          await onListen(server);
        } catch (e) {
          console.warn(`[${serviceName}] onListen error:`, e.message);
        }
      }
      if (process.env.SKIP_SERVICE_REGISTRATION === 'true') return;
      if (!process.env.CONDUCTOR_URL) {
        console.warn(`[${serviceName}] CONDUCTOR_URL not set; skipping registration`);
        return;
      }
      if (typeof register === 'function') {
        try {
          await register();
        } catch (e) {
          console.warn(`[${serviceName}] Registration error:`, e.message);
        }
      }
    });
    return server;
  }

  return { app, listen, projectId };
}

module.exports = { createManagerApp, projectId, errorHandler };
