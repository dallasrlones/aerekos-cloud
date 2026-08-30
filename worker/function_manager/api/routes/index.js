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

router.use('/functions', crudRouter(service));
module.exports = { router, service };
