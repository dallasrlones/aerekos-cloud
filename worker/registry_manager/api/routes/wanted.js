'use strict';

const express = require('express');
const { RegistryOpsService } = require('../services/RegistryOpsService');

const router = express.Router();
const svc = new RegistryOpsService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

function handle(res, next, e) {
  if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  next(e);
}

router.get('/', async (req, res, next) => {
  try {
    res.json({ items: await svc.listWanted(q(req)) });
  } catch (e) { handle(res, next, e); }
});

router.post('/', async (req, res, next) => {
  try {
    const item = await svc.createWanted({ ...req.body, project_id: q(req) });
    res.status(201).json({ item });
  } catch (e) { handle(res, next, e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    res.json({ item: await svc.updateWanted(req.params.id, q(req), req.body || {}) });
  } catch (e) { handle(res, next, e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await svc.delWanted(req.params.id, q(req)));
  } catch (e) { handle(res, next, e); }
});

router.post('/:id/run-now', async (req, res, next) => {
  try {
    res.json(await svc.runNow(req.params.id, q(req)));
  } catch (e) { handle(res, next, e); }
});

module.exports = router;
