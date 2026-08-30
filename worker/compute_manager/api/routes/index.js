const express = require('express');
const router = express.Router();
const tasks = require('./tasks');
const { TaskService } = require('../services/TaskService');
const hostService = new TaskService();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'compute_manager',
    title: 'Compute Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    description: 'ECS-style tasks on the worker (Docker via dockerode)'
  });
});

router.get('/host/containers', async (_req, res, next) => {
  try {
    const containers = await hostService.docker.listContainers();
    res.json({ containers });
  } catch (e) {
    next(e);
  }
});

router.use('/builds', require('./builds'));
router.use('/tasks', tasks);

module.exports = router;
