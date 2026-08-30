const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { VectorStore } = require('../services/VectorStore');
const service = new ItemService();
const vectors = new VectorStore();
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
    service: process.env.SERVICE_NAME || 'vector_manager',
    title: 'Vector indexes',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'OpenSearch kNN',
    message: 'Vector upsert/query facade (sqlite cosine or db_manager)'
  });
});

router.post('/upsert', wrap(async (req, res) => {
  const pid = projectId(req);
  res.json(await vectors.upsert({ ...req.body, project_id: pid }));
}));

router.post('/query', wrap(async (req, res) => {
  const pid = projectId(req);
  res.json(await vectors.query({ ...req.body, project_id: pid }));
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'vector_manager'));
router.use('/indexes', crudRouter(service));
module.exports = { router, service };
