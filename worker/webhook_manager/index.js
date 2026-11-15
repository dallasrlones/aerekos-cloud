require('dotenv').config();
const { assertNoSkipFakes } = require('../shared/prodGuards');
assertNoSkipFakes({ extra: ['SKIP_OUTBOUND'] });
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const routes = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'webhook_manager',
  defaultPort: 3112,
  db,
  register: makeRegister({
    serviceName: 'webhook_manager',
    defaultPort: 3112,
    capabilities: ['webhooks', 'fanout'],
  }),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', routes);
  },
});

if (require.main === module) listen();
module.exports = app;
