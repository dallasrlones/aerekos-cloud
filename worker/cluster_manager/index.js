require('dotenv').config();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'cluster_manager',
  defaultPort: 3151,
  db,
  register: makeRegister({ serviceName: 'cluster_manager', defaultPort: 3151, capabilities: ["k8s","k3s"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();
module.exports = app;
