'use strict';

require('dotenv').config();
const { assertNoSkipFakes } = require('../shared/prodGuards');
// Shared skip-fakes (incl. SKIP_HOST_PATCH) refused in production — real host probe lives on the worker.
assertNoSkipFakes();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const router = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'system_manager',
  defaultPort: 3127,
  db,
  register: makeRegister({
    serviceName: 'system_manager',
    defaultPort: 3127,
    capabilities: ['maintenance', 'tasks'],
  }),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();
module.exports = app;
