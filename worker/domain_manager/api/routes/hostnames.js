'use strict';

const express = require('express');
const { HostnameBindingService } = require('../services/HostnameBindingService');
const { ZoneService } = require('../services/ZoneService');

const router = express.Router();
const svc = new HostnameBindingService();
const zones = new ZoneService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

router.get('/zones', async (req, res, next) => {
  try {
    res.json({ zones: await zones.listZones() });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/hostnames', async (req, res, next) => {
  try {
    res.json({ hostnames: await svc.list(q(req)) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/hostnames', async (req, res, next) => {
  try {
    const item = await svc.create({ ...req.body, project_id: q(req) });
    res.status(201).json({ hostname: item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.patch('/hostnames/:id', async (req, res, next) => {
  try {
    const item = await svc.update(req.params.id, q(req), req.body || {});
    res.json({ hostname: item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.delete('/hostnames/:id', async (req, res, next) => {
  try {
    res.json(await svc.del(req.params.id, q(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = router;
