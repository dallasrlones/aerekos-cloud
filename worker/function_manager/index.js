require('dotenv').config();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'function_manager',
  defaultPort: 3139,
  db,
  register: makeRegister({ serviceName: 'function_manager', defaultPort: 3139, capabilities: ["lambda","functions"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) {
  listen();
  if (process.env.SKIP_POLLER !== '1' && process.env.SKIP_POLLER !== 'true') {
    const ms = Number(process.env.FUNCTION_POLL_MS || 1000);
    setInterval(() => {
      service.pollAll().catch((e) => console.error('[function_manager] poll', e.message));
    }, Number.isFinite(ms) ? ms : 1000);
  }
}
module.exports = app;
