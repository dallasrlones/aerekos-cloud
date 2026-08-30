const express = require('express');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { hub } = require('../hub');

const service = new ItemService();
const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'websocket_manager',
    title: 'WebSocket channels',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'API Gateway WebSocket',
    message: 'Direct WSS subscribe + HTTP publish. Conductor Socket.IO is unchanged.',
  });
});

router.post('/publish', async (req, res, next) => {
  try {
    const pid = projectId(req);
    const name = String(req.body?.channel || req.body?.name || 'app').trim();
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    const result = hub.publish(pid, name, req.body?.payload ?? req.body?.data ?? {});
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.post('/channels/:id/publish', async (req, res, next) => {
  try {
    const pid = projectId(req);
    const ch = await service.get(req.params.id, pid);
    const result = hub.publish(pid, ch.name, req.body?.payload ?? req.body?.data ?? {});
    res.json({ ok: true, ...result, channel: ch.name });
  } catch (e) {
    next(e);
  }
});

router.post('/internal/deliver', (req, res) => {
  const pid = req.body?.project_id || req.headers['x-project-id'];
  const name = String(req.body?.channel || 'app').trim();
  const result = hub.publish(pid, name, req.body?.payload ?? {});
  res.json({ ok: true, ...result });
});

router.use('/channels', crudRouter(service));
module.exports = { router, service };
