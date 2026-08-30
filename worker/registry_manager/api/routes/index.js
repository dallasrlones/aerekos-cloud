const express = require('express');
const registry = require('./registry');
const registries = require('./registries');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'registry_manager',
    title: 'Container Registry Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message:
      'Per-project registry entries (CRUD at /registries) + npm/pypi artifacts at /artifacts + public GET /registry/config (no secrets). See REGISTRY.md.'
  });
});

router.use('/registry', registry);

router.get('/images/project', async (req, res, next) => {
  try {
    const { RegistryOpsService } = require('../services/RegistryOpsService');
    const ops = new RegistryOpsService();
    const pid = req.query.project_id || req.headers['x-project-id'];
    res.json(await ops.projectImages(pid));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/images/import', async (req, res, next) => {
  try {
    const { RegistryOpsService } = require('../services/RegistryOpsService');
    const ops = new RegistryOpsService();
    const pid = req.body?.project_id || req.query.project_id || req.headers['x-project-id'];
    const tarPath = req.body?.tar_path;
    res.status(201).json(await ops.importTar(pid, tarPath, req.body?.name));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const { RegistryOpsService } = require('../services/RegistryOpsService');
    const ops = new RegistryOpsService();
    res.json(await ops.inventory(req.query.worker_id));
  } catch (e) {
    next(e);
  }
});

router.use('/wanted', require('./wanted'));
router.use('/registries', registries);
router.use('/artifacts', require('./artifacts'));

module.exports = router;
