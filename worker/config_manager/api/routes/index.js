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
  const ns = req.body?.namespace || 'app';
  const flag = req.body?.flag || 'example';
  const items = await service.list(pid);
  const row = items.find((i) => i.name === ns);
  let flags = {};
  try { flags = JSON.parse(row?.flags || '{}'); } catch { flags = {}; }
  res.json({ namespace: ns, flag, value: Object.prototype.hasOwnProperty.call(flags, flag) ? flags[flag] : false });
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'config_manager'));
router.use('/namespaces', crudRouter(service));
module.exports = { router, service };
