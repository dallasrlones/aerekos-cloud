const express = require('express');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { FunctionService } = require('../services/FunctionService');

const service = new FunctionService();
const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'function_manager',
    title: 'Functions',
    aws: 'Lambda',
    status: 'active',
    message: 'Sync invoke or Event → inbox queue. Runs node handlers (or compute_manager when image is set).',
  });
});

router.post('/functions/:name/invoke', async (req, res, next) => {
  try {
    const pid = projectId(req);
    const result = await service.invoke(pid, req.params.name, {
      payload: req.body?.payload ?? req.body,
      invocation_type: req.body?.invocation_type || req.body?.invocationType,
    });
    res.status(result.status === 202 ? 202 : 200).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/poll', async (req, res, next) => {
  try {
    res.json(await service.pollOnce(projectId(req)));
  } catch (e) { next(e); }
});

router.get('/functions/:id/event-sources', async (req, res, next) => {
  try {
    res.json({ items: await service.listEventSources(projectId(req), req.params.id) });
  } catch (e) { next(e); }
});

router.post('/functions/:id/event-sources', async (req, res, next) => {
  try {
    const r = await service.attachQueue(projectId(req), req.params.id, req.body?.ref || req.body?.queue, { engine: req.body?.engine });
    res.status(201).json(r);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.delete('/functions/:id/event-sources/:sid', async (req, res, next) => {
  try {
    res.json(await service.detachQueue(projectId(req), req.params.id, req.params.sid));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.use('/functions', crudRouter(service));
module.exports = { router, service };
