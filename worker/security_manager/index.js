require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('./api/models');
const db = require('./api/utils/dbClient');
const { registerWithConductor } = require('./api/utils/serviceRegistration');
const { setupPrometheus } = require('../shared/simplePrometheusMetrics');
const routes = require('./api/routes');
const errorHandler = require('./api/middleware/errorHandler');
const app = express();
const PORT = parseInt(process.env.PORT || '3108', 10);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
setupPrometheus(app, { serviceName: 'security_manager' });
app.get('/health', async (req, res) => {
  try {
    const health = await db.healthCheck();
    if (!health.healthy) {
      return res.status(503).json({ status: 'unhealthy', service: process.env.SERVICE_NAME || 'security_manager', error: health.error || 'Database check failed', timestamp: new Date().toISOString() });
    }
    res.status(200).json({ status: 'healthy', service: process.env.SERVICE_NAME || 'security_manager', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: process.env.SERVICE_NAME || 'security_manager', error: error.message, timestamp: new Date().toISOString() });
  }
});
app.get('/ready', async (req, res) => {
  try {
    const health = await db.healthCheck();
    if (!health.healthy) {
      return res.status(503).json({ status: 'not ready', service: process.env.SERVICE_NAME || 'security_manager', error: health.error || 'Database not available', timestamp: new Date().toISOString() });
    }
    res.status(200).json({ status: 'ready', service: process.env.SERVICE_NAME || 'security_manager' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message, timestamp: new Date().toISOString() });
  }
});
app.use('/api/v1', routes);
app.use(errorHandler);
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`[security_manager] listening on ${PORT}`);
    if (process.env.SKIP_SERVICE_REGISTRATION === 'true') return;
    if (!process.env.CONDUCTOR_URL) { console.warn('[security_manager] CONDUCTOR_URL not set; skipping registration'); return; }
    try { await registerWithConductor(); } catch (e) { console.warn('Registration error:', e.message); }
  });
}
module.exports = app;
