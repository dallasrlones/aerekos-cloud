'use strict';

const { fail, projectId, CrudService } = require('./crudCore');

function crudRouter(service) {
  // Lazy-require so /app/shared can load CrudService without Express.
  const express = require('express');
  const r = express.Router();
  r.post('/', async (req, res, next) => {
    try {
      const item = await service.create({ ...req.body, project_id: projectId(req) });
      res.status(201).json({ item });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  });
  r.get('/', async (req, res, next) => {
    try {
      res.json({ items: await service.list(projectId(req)) });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  });
  r.get('/:id', async (req, res, next) => {
    try {
      res.json({ item: await service.get(req.params.id, projectId(req)) });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  });
  const upd = async (req, res, next) => {
    try {
      res.json({ item: await service.update(req.params.id, projectId(req), req.body || {}) });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  };
  r.patch('/:id', upd);
  r.put('/:id', upd);
  r.delete('/:id', async (req, res, next) => {
    try {
      res.json(await service.del(req.params.id, projectId(req)));
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  });
  return r;
}

module.exports = { CrudService, crudRouter, projectId, fail };
