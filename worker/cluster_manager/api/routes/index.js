const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { detectK3s, installK3s } = require('../services/K3sHost');
const { listFleet } = require('../services/DockerFleet');
const service = new ItemService();
const router = express.Router();

function wrap(fn) {
  return async (req, res, next) => {
    try { await fn(req, res); } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  };
}

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'cluster_manager',
    title: 'Clusters',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'EKS',
    message: 'Docker fleet inventory; optional k3s on a host'
  });
});

router.get('/clusters/:id/fleet', wrap(async (req, res) => {
  const pid = projectId(req);
  const item = await service.get(req.params.id, pid);
  const fleet = await listFleet();
  res.json({ item, ...fleet });
}));

router.get('/clusters/:id/k3s/status', wrap(async (req, res) => {
  const pid = projectId(req);
  const item = await service.get(req.params.id, pid);
  const detected = detectK3s();
  const status = detected.installed ? 'ready' : 'absent';
  await service.update(item.id, pid, { status });
  res.json({ item: await service.get(item.id, pid), ...detected, status });
}));

router.post('/clusters/:id/k3s/install', wrap(async (req, res) => {
  const pid = projectId(req);
  const item = await service.get(req.params.id, pid);
  const out = await installK3s({ confirm: req.body?.confirm === true });
  const status = out.skipped ? 'skipped' : (out.installed ? 'installed' : 'unknown');
  await service.update(item.id, pid, { status });
  res.json({ item: await service.get(item.id, pid), ...out });
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'cluster_manager'));
router.use('/clusters', crudRouter(service));
module.exports = { router, service };
