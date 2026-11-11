// /api/v1/users — per-project human users (password grant).
const express = require('express');
const { UserService } = require('../services/UserService');

const r = express.Router();
const s = new UserService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

// POST /api/v1/users  { project_id, username, password, name?, display_color?, enabled? }
r.post('/', async (req, res, next) => {
  try {
    const out = await s.create({ ...req.body, project_id: q(req) });
    res.status(201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

// GET /api/v1/users?project_id=
r.get('/', async (req, res, next) => {
  try {
    const items = await s.list(q(req));
    res.json({ items, users: items });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

// GET /api/v1/users/:id?project_id=
r.get('/:id', async (req, res, next) => {
  try {
    const item = await s.get(req.params.id, q(req));
    res.json({ user: item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

// PATCH/PUT /api/v1/users/:id  { name?, display_color?, password?, enabled? }
const upd = async (req, res, next) => {
  try {
    const item = await s.update(req.params.id, q(req), req.body || {});
    res.json({ user: item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
};
r.patch('/:id', upd);
r.put('/:id', upd);

// DELETE /api/v1/users/:id?project_id=
r.delete('/:id', async (req, res, next) => {
  try {
    res.json(await s.del(req.params.id, q(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = r;
