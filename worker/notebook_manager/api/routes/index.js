const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { runNotebook } = require('../services/NotebookRunner');
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
    service: process.env.SERVICE_NAME || 'notebook_manager',
    title: 'Notebooks',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'SageMaker notebook',
    message: 'Notebooks'
  });
});

router.post('/notebooks/:id/run', wrap(async (req, res) => {
  res.json(await runNotebook(service, req.params.id, projectId(req), req.body || {}));
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'notebook_manager'));
router.use('/notebooks', crudRouter(service));
module.exports = { router, service };
