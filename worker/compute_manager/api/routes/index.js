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
    description: 'aerekos Compute — Kubernetes-class orchestrator (Deployments; Docker node agent)',
    orchestrator: 'aerekos-compute',
    adr: '004-aerekos-compute-orchestrator',
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
router.use('/tasks', require('./workloads'));
router.use('/deployments', require('./deployments'));

module.exports = router;
