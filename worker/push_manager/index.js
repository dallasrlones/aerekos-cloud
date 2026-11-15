require('dotenv').config();
const { assertNoSkipFakes } = require('../shared/prodGuards');
// SKIP_PUSH / SKIP_OUTBOUND force queue-only send in tests/dev — refused in production.
assertNoSkipFakes({ extra: ['SKIP_PUSH', 'SKIP_OUTBOUND'] });
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'push_manager',
  defaultPort: 3153,
  db,
  register: makeRegister({ serviceName: 'push_manager', defaultPort: 3153, capabilities: ["push"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();
module.exports = app;
