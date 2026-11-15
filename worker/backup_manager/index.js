require('dotenv').config();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: 'backup_manager',
  defaultPort: 3134,
  db,
  register: makeRegister({ serviceName: 'backup_manager', defaultPort: 3134, capabilities: ["backup", "restore"] }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
    if (require.main === module && process.env.SKIP_BACKUP_CRON !== '1') {
      const { BackupScheduler } = require('./api/services/BackupScheduler');
      const { JobService } = require('./api/services/JobService');
      new BackupScheduler({ jobService: new JobService() }).start();
    }
  },
});

if (require.main === module) listen();
module.exports = app;
