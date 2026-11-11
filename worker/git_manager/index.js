require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('./api/models');
const db = require('./api/utils/dbClient');
const { registerWithConductor } = require('./api/utils/serviceRegistration');
const { setupPrometheus } = require('../shared/simplePrometheusMetrics');
const routes = require('./api/routes');
const gitHttp = require('./api/routes/gitHttp');
const errorHandler = require('./api/middleware/errorHandler');

const app = express();
const PORT = parseInt(process.env.PORT || '3130', 10);

app.use(cors());
setupPrometheus(app, { serviceName: 'git_manager' });

// Full request trail: request line, then status + duration (+JSON body).
app.use((req, res, next) => {
  const start = Date.now();
  const now = () => new Date().toISOString();
  const quiet = req.path.startsWith('/health') || req.path.startsWith('/metrics') || req.path.startsWith('/git');
  if (!quiet) console.log(`[${now()}] --> ${req.method} ${req.path}${req.search || ''}`);
  res.on('finish', () => {
    let bodyLog = '';
    if (req.method !== 'GET' && req.body && typeof req.body === 'object') {
      try {
        let s = JSON.stringify(req.body);
        if (s.length > 2000) s = s.slice(0, 2000) + '…';
        bodyLog = ' body=' + s;
      } catch (e) { bodyLog = ' body=<unserializable>'; }
    }
    if (!quiet) console.log(`[${now()}] <-- ${req.method} ${req.originalUrl || req.path} ${res.statusCode} ${Date.now() - start}ms${bodyLog}`);
  });
  next();
});

// Git Smart HTTP transport is mounted BEFORE the JSON body parser so the
// upload-pack / receive-pack request streams reach the git binary untouched.
app.use('/git', gitHttp);
app.use('/', gitHttp);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (req, res) => {
  try {
    const health = await db.healthCheck();
    if (!health.healthy) {
      return res.status(503).json({
        status: 'unhealthy',
        service: process.env.SERVICE_NAME || 'git_manager',
        error: health.error || 'Database check failed',
        timestamp: new Date().toISOString()
      });
    }
    res.status(200).json({
      status: 'healthy',
      service: process.env.SERVICE_NAME || 'git_manager',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: process.env.SERVICE_NAME || 'git_manager',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/ready', async (req, res) => {
  try {
    const health = await db.healthCheck();
    if (!health.healthy) {
      return res.status(503).json({
        status: 'not ready',
        service: process.env.SERVICE_NAME || 'git_manager',
        error: health.error || 'Database not available',
        timestamp: new Date().toISOString()
      });
    }
    res.status(200).json({ status: 'ready', service: process.env.SERVICE_NAME || 'git_manager' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message, timestamp: new Date().toISOString() });
  }
});

app.use('/api/v1', routes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`[git_manager] listening on ${PORT}`);
    if (process.env.SKIP_SERVICE_REGISTRATION === 'true') return;
    if (!process.env.CONDUCTOR_URL) {
      console.warn('[git_manager] CONDUCTOR_URL not set; skipping conductor registration');
      return;
    }
    try {
      await registerWithConductor();
    } catch (e) {
      console.warn('[git_manager] Registration error:', e.message);
    }
  });
}

module.exports = app;
