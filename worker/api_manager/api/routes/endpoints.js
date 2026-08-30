const express = require('express');
const { ApiRouteService } = require('../services/ApiRouteService');
const r = express.Router();
const s = new ApiRouteService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
r.post('/', async (req,res,next) => { try { const o = await s.create({ ...req.body, project_id: q(req) }); res.status(201).json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.post('/seed-presets', async (req,res,next) => {
  try {
    const pid = q(req);
    res.json(await s.seedPresets(pid));
  } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); }
});
r.post('/match', async (req,res,next) => {
  try {
    res.json(await s.match({ ...req.body, project_id: q(req) || req.body?.project_id }));
  } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); }
});
r.get('/', async (req,res,next) => { try { const o = await s.list(q(req)); res.json({ items: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.patch('/:id/scale', async (req,res,next) => {
  try {
    res.json({ item: await s.scale(req.params.id, q(req), req.body?.desired) });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); }
});
r.get('/:id', async (req,res,next) => { try { const o = await s.get(req.params.id, q(req)); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
const upd = async (req,res,next) => { try { const o = await s.update(req.params.id, q(req), req.body || {}); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } };
r.patch('/:id', upd);
r.put('/:id', upd);
r.delete('/:id', async (req,res,next) => { try { res.json(await s.del(req.params.id, q(req))); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
module.exports = r;
