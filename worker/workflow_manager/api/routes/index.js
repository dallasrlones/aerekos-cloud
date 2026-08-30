const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { WorkflowRunner } = require('../services/WorkflowRunner');
const service = new ItemService();
const runner = new WorkflowRunner(service);
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
    service: process.env.SERVICE_NAME || 'workflow_manager',
    title: 'State machines',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Step Functions',
    message: 'State machines (http, queue, wait, choice, function)'
  });
});

router.post('/machines/:id/run', wrap(async (req, res) => {
  const out = await runner.run(req.params.id, projectId(req), req.body?.input || req.body || {});
  res.json(out);
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'workflow_manager'));
router.use('/machines', crudRouter(service));
module.exports = { router, service };
