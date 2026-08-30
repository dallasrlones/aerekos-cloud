const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const service = new ItemService();
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'iot_manager',
    title: 'IoT things',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'IoT Core',
    message: 'IoT things'
  });
});
router.post('/publish', async (req, res, next) => {
  try {
    const { proxy, skipFlag } = require('../../../shared/conductorProxy');
    const topic = req.body?.topic || 'test';
    const payload = req.body?.payload || {};
    const pid = req.body?.project_id || req.query.project_id || req.headers['x-project-id'];
    if (skipFlag('SKIP_OUTBOUND')) {
      return res.json({ ok: true, topic, payload, skipped: true });
    }
    const items = pid ? await service.list(pid) : [];
    const thing = items.find((t) => t.name === topic || t.topic === topic || t.id === topic);
    if (thing && pid) {
      await service.update(thing.id, pid, { status: 'online', topic: thing.topic || topic });
    }
    if (pid) {
      await proxy('POST', '/api/services/websocket_manager/api/v1/publish', {
        projectId: pid,
        data: { project_id: pid, channel: topic, payload },
        timeout: 10000,
      });
    }
    res.json({ ok: true, topic, payload, thing: thing ? thing.id : null });
  } catch (e) { next(e); }
});
router.use(knockoutTry(process.env.SERVICE_NAME || 'iot_manager'));
router.use('/things', crudRouter(service));
module.exports = { router, service };
