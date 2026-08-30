const express = require('express');
const resR = require('./hosts');
const { projectId } = require('../../../shared/crudCore');
const { HostRecordService } = require('../services/HostRecordService');
const { syncHosts } = require('../services/syncWorkers');
const service = new HostRecordService();
const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'host_manager',
    title: 'host_manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message: 'Host / inventory records synced from conductor /api/workers.',
  });
});

router.post('/sync', async (req, res, next) => {
  try {
    res.json(await syncHosts(service, projectId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.use('/hosts', resR);
module.exports = router;
