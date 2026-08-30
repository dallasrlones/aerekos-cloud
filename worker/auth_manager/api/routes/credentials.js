const express = require('express');
const { CredentialService } = require('../services/CredentialService');

const r = express.Router();
const s = new CredentialService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.post('/', async (req, res, next) => {
  try {
    const out = await s.create({ ...req.body, project_id: q(req) });
    res.status(201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

r.get('/', async (req, res, next) => {
  try {
    const items = await s.list(q(req));
    res.json({ items, credentials: items });
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

r.post('/:id/rotate', async (req, res, next) => {
  try {
    const out = await s.rotate(req.params.id, q(req));
    res.json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = r;
