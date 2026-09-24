require('dotenv').config();
require('./api/models');
const db = require('./api/utils/dbClient');
// Add system_id to existing volumes (no-op on fresh DBs / missing files).
try { require('./api/utils/migrations').ensureSystemIdColumns(); } catch (e) { /* non-fatal */ }
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'download_manager',
  defaultPort: 3133,
  db,
  register: makeRegister({ serviceName: 'download_manager', defaultPort: 3133, capabilities: ["download","torrent","yt-dlp"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();

// Internal ticker: advance downloads on a fixed interval so the service makes
// progress without an external scheduler. Idempotent (in-flight set dedupes)
// and safe to run alongside the manual /tick route. Disable with DISABLE_TICKER=1.
if (require.main === module && process.env.DISABLE_TICKER !== '1') {
  const tickMs = Math.max(10000, parseInt(process.env.TICK_INTERVAL_MS || '30000', 10));
  const { downloads } = require('./api/routes');
  setInterval(() => {
    downloads.tick().catch((e) => {
      try { console.error('[download_manager] tick error:', e.message); } catch { /* ignore */ }
    });
  }, tickMs);
}

module.exports = app;
