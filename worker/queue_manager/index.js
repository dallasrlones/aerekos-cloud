require('dotenv').config();
require('./api/models');
const express = require('express');
const cors = require('cors');
const { registerWithConductor } = require('./api/utils/serviceRegistration');
const routes = require('./api/routes');
const errorHandler = require('./api/middleware/errorHandler');
const { setupPrometheus } = require('../shared/simplePrometheusMetrics');

const app = express();
const PORT = parseInt(process.env.PORT || '3101', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
setupPrometheus(app, { serviceName: 'queue_manager' });

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: process.env.SERVICE_NAME || 'queue_manager',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const db = require('./api/utils/dbClient');
    const h = await db.healthCheck();
    if (h.healthy) {
      return res.status(200).json({ status: 'ready', service: process.env.SERVICE_NAME || 'queue_manager', database: 'ok' });
    }
  } catch (e) {
    // fall through
  }
  return res.status(503).json({ status: 'not_ready', service: process.env.SERVICE_NAME || 'queue_manager' });
});

app.use('/api/v1', routes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`[queue_manager] listening on ${PORT}`);
    if (process.env.SKIP_SERVICE_REGISTRATION === 'true') return;
    if (!process.env.CONDUCTOR_URL) {
      console.warn('[queue_manager] CONDUCTOR_URL not set; skipping conductor registration');
      return;
    }
    try {
      await registerWithConductor();
    } catch (e) {
      console.warn(`[queue_manager] Registration error:`, e.message);
    }
  });
}

module.exports = app;
