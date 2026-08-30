require('dotenv').config();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');
const { hub } = require('./api/hub');

const { app, listen } = createManagerApp({
  serviceName: 'websocket_manager',
  defaultPort: 3131,
  db,
  register: makeRegister({ serviceName: 'websocket_manager', defaultPort: 3131, capabilities: ["realtime","websocket"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) {
  listen((server) => hub.attach(server));
}
module.exports = app;
