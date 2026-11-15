require('dotenv').config();
const { assertNoSkipFakes } = require('../shared/prodGuards');
assertNoSkipFakes();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'status_manager',
  defaultPort: 3150,
  db,
  register: makeRegister({ serviceName: 'status_manager', defaultPort: 3150, capabilities: ["status"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();
module.exports = app;
