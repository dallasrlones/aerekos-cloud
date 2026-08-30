const express = require('express');
const { AiProviderService } = require('../services/AiProviderService');
const { LocalIntegrationSeed } = require('../services/LocalIntegrationSeed');
const { IntegrationTest } = require('../services/IntegrationTest');
const { requireAuth } = require('../../../shared/authManagerClient');

const r = express.Router();
const s = new AiProviderService();
const seed = new LocalIntegrationSeed();
const tester = new IntegrationTest();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.use(requireAuth());

r.post('/seed-local', async (req, res, next) => {
  try {
    const projectId = q(req);
    res.json(await seed.seed(projectId));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

r.post('/:id/test', async (req, res, next) => {
  try {
    res.json(await tester.test(req.params.id, q(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

r.post('/', async (req, res, next) => {
  try {
    const item = await s.create({ ...req.body, project_id: q(req) });
    res.status(201).json({ item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

r.get('/', async (req, res, next) => {
  try {
    const items = await s.list(q(req), req.query.capability);
    res.json({ items });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    const item = await s.get(req.params.id, q(req));
    res.json({ item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

const upd = async (req, res, next) => {
  try {
    const item = await s.update(req.params.id, q(req), req.body || {});
    res.json({ item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
};

r.patch('/:id', upd);
r.put('/:id', upd);

r.delete('/:id', async (req, res, next) => {
  try {
    res.json(await s.del(req.params.id, q(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = r;
