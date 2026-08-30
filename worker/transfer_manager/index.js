require('dotenv').config();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'transfer_manager',
  defaultPort: 3148,
  db,
  register: makeRegister({ serviceName: 'transfer_manager', defaultPort: 3148, capabilities: ["sftp","transfer"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();
module.exports = app;
