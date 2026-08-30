const express = require('express');
const resR = require('./annotations');
const { projectId } = require('../../../shared/crudCore');
const { WorkerAnnotationService } = require('../services/WorkerAnnotationService');
const { syncAnnotations } = require('../services/syncWorkers');
const service = new WorkerAnnotationService();
const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'worker_manager',
    title: 'worker_manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message: 'Worker fleet labels synced from conductor /api/workers.',
  });
});

router.post('/sync', async (req, res, next) => {
  try {
    res.json(await syncAnnotations(service, projectId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.use('/annotations', resR);
module.exports = router;
