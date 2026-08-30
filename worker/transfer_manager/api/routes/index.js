const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { putObject, getObject } = require('../services/ObjectCopy');
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
    service: process.env.SERVICE_NAME || 'transfer_manager',
    title: 'SFTP endpoints',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Transfer Family',
    message: 'Object copy via storage_manager (SFTP listener optional)'
  });
});

router.post('/endpoints/:id/put', wrap(async (req, res) => {
  const pid = projectId(req);
  const item = await service.get(req.params.id, pid);
  res.json(await putObject(item, pid, req.body || {}));
}));

router.post('/endpoints/:id/get', wrap(async (req, res) => {
  const pid = projectId(req);
  const item = await service.get(req.params.id, pid);
  res.json(await getObject(item, pid, req.body || {}));
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'transfer_manager'));
router.use('/endpoints', crudRouter(service));
module.exports = { router, service };
