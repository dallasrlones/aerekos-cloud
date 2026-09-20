'use strict';

const express = require('express');
const { EngineService } = require('../services/EngineService');
const { requireAuth } = require('../../../shared/authManagerClient');

const r = express.Router();
const service = new EngineService();

r.use(requireAuth());
r.use((req, _res, next) => {
  service.useToken(req.headers.authorization || '');
  next();
});

function sendErr(res, e, next) {
  if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  return next(e);
}

r.get('/catalog', (_req, res) => {
  res.json({ catalog: service.catalog() });
});

r.get('/', async (_req, res, next) => {
  try {
    res.json(await service.list());
  } catch (e) {
    sendErr(res, e, next);
  }
});

r.post('/', async (req, res, next) => {
  try {
    const engine = await service.place({
      kind: req.body?.kind,
      worker_id: req.body?.worker_id,
      start: req.body?.start,
    });
    res.status(201).json({ engine });
  } catch (e) {
    sendErr(res, e, next);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    res.json({ engine: await service.get(req.params.id) });
  } catch (e) {
    sendErr(res, e, next);
  }
});

r.post('/:id/start', async (req, res, next) => {
  try {
    res.json({ engine: await service.start(req.params.id) });
  } catch (e) {
    sendErr(res, e, next);
  }
});

r.post('/:id/stop', async (req, res, next) => {
  try {
    res.json({ engine: await service.stop(req.params.id) });
  } catch (e) {
    sendErr(res, e, next);
  }
});

module.exports = r;
