const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { compileSchema } = require('../services/compileSchema');
const { executeGraphql } = require('../services/executeGraphql');
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
    service: process.env.SERVICE_NAME || 'graphql_manager',
    title: 'GraphQL APIs',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'AppSync',
    message: 'GraphQL APIs compiled from Data API models and relationships'
  });
});

router.post('/compile', wrap(async (req, res) => {
  const models = req.body?.models || {};
  const schema = compileSchema(models);
  const name = req.body?.name || 'app';
  const pid = projectId(req);
  let item = null;
  if (pid) {
    const existing = await service.list(pid);
    item = existing.find((i) => i.name === name);
    if (item) await service.update(item.id, pid, { schema, data_app: name });
    else item = await service.create({ project_id: pid, name, schema, data_app: name });
  }
  res.json({ schema, item });
}));

router.post('/execute', wrap(async (req, res) => {
  const out = await executeGraphql({
    service,
    project_id: projectId(req),
    name: req.body?.name || 'app',
    query: req.body?.query,
    variables: req.body?.variables,
    models: req.body?.models,
  });
  res.json(out);
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'graphql_manager'));
router.use('/apis', crudRouter(service));
module.exports = { router, service };
