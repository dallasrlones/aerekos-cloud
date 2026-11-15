'use strict';

require('dotenv').config();

/**
 * Unified notify_manager (W9a Phase 1 HTTP surface).
 * Providers + facade live in worker/shared; this package owns health/proxy CRUD.
 * Non-prod defaults NOTIFY_USE_MOCK=1 (no paid Twilio/Slack/SMTP). Production refuses it.
 */

if (process.env.NODE_ENV !== 'production') {
  if (process.env.NOTIFY_USE_MOCK == null || process.env.NOTIFY_USE_MOCK === '') {
    process.env.NOTIFY_USE_MOCK = '1';
  }
}

const { assertNoSkipFakes } = require('../shared/prodGuards');
assertNoSkipFakes({ extra: ['NOTIFY_USE_MOCK', 'SKIP_OUTBOUND'] });

require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, messageService } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'notify_manager',
  defaultPort: 3154,
  db,
  register: makeRegister({
    serviceName: 'notify_manager',
    defaultPort: 3154,
    capabilities: ['notify', 'transactional', 'alerts'],
  }),
  ensureDefaults: (projectId) => messageService.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();
module.exports = app;
