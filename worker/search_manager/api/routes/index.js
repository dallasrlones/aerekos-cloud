const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { FtsStore } = require('../services/FtsStore');
const service = new ItemService();
const fts = new FtsStore();
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
    service: process.env.SERVICE_NAME || 'search_manager',
    title: 'Search indexes',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'OpenSearch',
    message: 'SQLite FTS5 search indexes'
  });
});

router.post('/query', wrap(async (req, res) => {
  const pid = projectId(req);
  const out = fts.query({
    project_id: pid,
    index: req.body?.index,
    q: req.body?.q || req.body?.query,
    query: req.body?.query,
  });
  res.json({ hits: out.hits, index: out.index, empty: out.empty });
}));

router.post('/index', wrap(async (req, res) => {
  const pid = projectId(req);
  const indexName = req.body?.index || 'docs';
  const existing = pid ? await service.list(pid) : [];
  if (pid && !existing.find((i) => i.name === indexName)) {
    await service.create({ project_id: pid, name: indexName, engine: 'fts5' });
  }
  const out = fts.indexDocs({ ...req.body, project_id: pid, index: indexName });
  res.status(201).json(out);
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'search_manager'));
router.use('/indexes', crudRouter(service));
module.exports = { router, service };
