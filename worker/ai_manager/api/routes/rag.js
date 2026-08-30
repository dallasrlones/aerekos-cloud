'use strict';

const express = require('express');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');
const { RagCollectionService } = require('../services/RagCollectionService');

const r = express.Router();
const svc = new RagCollectionService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.use(requireAuth());

function err(res, e, next) {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  return next(e);
}

r.post('/', async (req, res, next) => {
  try {
    const item = await svc.create({ ...req.body, project_id: q(req) });
    res.status(201).json({ item });
  } catch (e) { err(res, e, next); }
});

r.get('/', async (req, res, next) => {
  try {
    res.json({ items: await svc.list(q(req)) });
  } catch (e) { err(res, e, next); }
});

r.post('/search', requireResource({ requiredScope: 'ai:InvokeRag' }), async (req, res, next) => {
  try {
    const pid = q(req);
    const name = req.body?.collection || req.body?.name || req.query?.collection;
    res.json(await svc.search(pid, name, req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.get('/:id', async (req, res, next) => {
  try {
    res.json({ item: await svc.get(req.params.id, q(req)) });
  } catch (e) { err(res, e, next); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    res.json({ item: await svc.update(req.params.id, q(req), req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    res.json(await svc.del(req.params.id, q(req)));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/documents', async (req, res, next) => {
  try {
    res.json({ items: await svc.listDocuments(req.params.id, q(req)) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/documents', async (req, res, next) => {
  try {
    res.status(201).json(await svc.ingest(req.params.id, q(req), req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.delete('/:id/documents/:docId', async (req, res, next) => {
  try {
    res.json(await svc.deleteDocument(req.params.id, q(req), req.params.docId));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/search', requireResource({ requiredScope: 'ai:InvokeRag' }), async (req, res, next) => {
  try {
    const col = await svc.get(req.params.id, q(req));
    res.json(await svc.search(q(req), col.name, req.body || {}));
  } catch (e) { err(res, e, next); }
});

module.exports = r;
