'use strict';

const express = require('express');
const { DataApiService } = require('../services/DataApiService');

const svc = new DataApiService();
const r = express.Router();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
const identity = (req) => ({ sub: req.headers['x-user-sub'] || req.body?.owner_id });

function sendErr(res, next, e) {
  if (e.status) return res.status(e.status).json({ error: { message: e.message } });
  return next(e);
}

r.get('/:app/:parent/:parentId/:child', async (req, res, next) => {
  try {
    const items = await svc.listNested(q(req), req.params.app, req.params.parent, req.params.parentId, req.params.child, req.query);
    res.json({ items });
  } catch (e) { sendErr(res, next, e); }
});

r.post('/:app/:parent/:parentId/:child', async (req, res, next) => {
  try {
    const item = await svc.createNested(q(req), req.params.app, req.params.parent, req.params.parentId, req.params.child, req.body || {}, identity(req));
    res.status(201).json({ item });
  } catch (e) { sendErr(res, next, e); }
});

r.get('/:app/:model', async (req, res, next) => {
  try {
    res.json({ items: await svc.listRecords(q(req), req.params.app, req.params.model, req.query) });
  } catch (e) { sendErr(res, next, e); }
});

r.post('/:app/:model', async (req, res, next) => {
  try {
    const item = await svc.createRecord(q(req), req.params.app, req.params.model, req.body || {}, identity(req));
    res.status(201).json({ item });
  } catch (e) { sendErr(res, next, e); }
});

r.get('/:app/:model/:id', async (req, res, next) => {
  try {
    res.json({ item: await svc.getRecord(q(req), req.params.app, req.params.model, req.params.id, req.query) });
  } catch (e) { sendErr(res, next, e); }
});

r.patch('/:app/:model/:id', async (req, res, next) => {
  try {
    res.json({ item: await svc.updateRecord(q(req), req.params.app, req.params.model, req.params.id, req.body || {}) });
  } catch (e) { sendErr(res, next, e); }
});

r.delete('/:app/:model/:id', async (req, res, next) => {
  try {
    res.json(await svc.deleteRecord(q(req), req.params.app, req.params.model, req.params.id));
  } catch (e) { sendErr(res, next, e); }
});

module.exports = r;
