'use strict';

const express = require('express');
const { DataApiService } = require('../services/DataApiService');

const svc = new DataApiService();
const r = express.Router();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

function sendErr(res, next, e) {
  if (e.status) return res.status(e.status).json({ error: { message: e.message } });
  return next(e);
}

r.post('/apply', async (req, res, next) => {
  try {
    res.json(await svc.apply(q(req), req.body || {}));
  } catch (e) { sendErr(res, next, e); }
});

r.get('/', async (req, res, next) => {
  try {
    res.json({ items: await svc.list(q(req)) });
  } catch (e) { sendErr(res, next, e); }
});

r.post('/:name/scale', async (req, res, next) => {
  try {
    res.json({ item: await svc.scale(q(req), req.params.name, req.body?.desired) });
  } catch (e) { sendErr(res, next, e); }
});

r.patch('/:name/scale', async (req, res, next) => {
  try {
    res.json({ item: await svc.scale(q(req), req.params.name, req.body?.desired) });
  } catch (e) { sendErr(res, next, e); }
});

r.post('/:name/autoscaling/evaluate', async (req, res, next) => {
  try {
    res.json(await svc.evaluateAutoscaling(q(req), req.params.name, req.body || {}));
  } catch (e) { sendErr(res, next, e); }
});

r.get('/:name', async (req, res, next) => {
  try {
    res.json({ item: svc.serialize(await svc.getByName(q(req), req.params.name)) });
  } catch (e) { sendErr(res, next, e); }
});

module.exports = r;
