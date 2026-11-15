const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
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
    service: process.env.SERVICE_NAME || 'config_manager',
    title: 'Config namespaces',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'AppConfig',
    message: 'Config namespaces'
  });
});

router.post('/evaluate', wrap(async (req, res) => {
  const pid = projectId(req);
  if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
  res.json(await service.evaluate(pid, {
    namespace: req.body?.namespace,
    flag: req.body?.flag,
  }));
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'config_manager'));
router.use('/namespaces', crudRouter(service));
module.exports = { router, service };
