require('dotenv').config();
const { assertNoSkipFakes } = require('../shared/prodGuards');
assertNoSkipFakes();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service, ingestTraces } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'trace_manager',
  defaultPort: 3143,
  db,
  register: makeRegister({ serviceName: 'trace_manager', defaultPort: 3143, capabilities: ["tracing"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    // OTLP/HTTP ingest path (not under /api/v1 — avoids colliding with traces CRUD)
    expressApp.post('/v1/traces', ingestTraces);
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();
module.exports = app;
