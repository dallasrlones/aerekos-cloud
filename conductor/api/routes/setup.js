'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const SetupService = require('../services/SetupService');

router.get('/graph', authenticate, (req, res) => {
  res.json(SetupService.getGraph());
});

router.get('/core-stack', authenticate, (req, res) => {
  res.json({ services: SetupService.getCoreStack() });
});

router.get('/packs', authenticate, (req, res) => {
  const { requireShared } = require('../utils/loadWorkerShared');
  const { listPacks } = requireShared('setupCatalog');
  res.json({ packs: listPacks() });
});

router.get('/click-ops', authenticate, (req, res) => {
  const { requireShared } = require('../utils/loadWorkerShared');
  const { listClickOps } = requireShared('clickOpsCatalog');
  res.json({ ops: listClickOps() });
});

router.get('/click-ops/:serviceName', authenticate, (req, res) => {
  const { requireShared } = require('../utils/loadWorkerShared');
  const { getClickOps, listClickOpsForService } = requireShared('clickOpsCatalog');
  const ops = getClickOps(req.params.serviceName);
  if (!ops) {
    return res.status(404).json({ error: { message: `No click-ops catalog for ${req.params.serviceName}` } });
  }
  res.json({ ops, all: listClickOpsForService(req.params.serviceName) });
});

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    if (!projectId) return res.status(400).json({ error: { message: 'project_id is required' } });
    res.json(await SetupService.getProjectSetupSummary(projectId, req.headers.authorization));
  } catch (err) {
    next(err);
  }
});

router.post('/enable', authenticate, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id;
    const service = req.body?.service;
    if (!projectId || !service) {
      return res.status(400).json({ error: { message: 'project_id and service are required' } });
    }
    const with_dependencies = req.body.with_dependencies !== false;
    const defaults = req.body.defaults !== false;
    const result = await SetupService.enableWithDependencies(projectId, service, { with_dependencies, defaults });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/packs/:pack', authenticate, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id;
    if (!projectId) return res.status(400).json({ error: { message: 'project_id is required' } });
    const result = await SetupService.enablePack(projectId, req.params.pack, {
      defaults: req.body?.defaults !== false,
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message, status: err.status } });
    next(err);
  }
});

module.exports = router;
