const express = require('express');
const { SecurityFindingService } = require('../services/SecurityFindingService');
const r = express.Router();
const s = new SecurityFindingService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
r.post('/scan', async (req,res,next) => {
  try {
    const o = await s.create({
      ...req.body,
      project_id: q(req),
      name: req.body?.name || `scan-${Date.now().toString(36)}`,
      severity: req.body?.severity || 'info',
      details: req.body?.details || req.body?.summary || 'metadata-only scan; no host reboot',
    });
    res.status(201).json({ item: o, note: 'metadata only; no host reboot' });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); }
});
r.post('/', async (req,res,next) => { try { const o = await s.create({ ...req.body, project_id: q(req) }); res.status(201).json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/', async (req,res,next) => { try { const o = await s.list(q(req)); res.json({ items: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/:id', async (req,res,next) => { try { const o = await s.get(req.params.id, q(req)); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
const upd = async (req,res,next) => { try { const o = await s.update(req.params.id, q(req), req.body || {}); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } };
r.patch('/:id', upd);
r.put('/:id', upd);
r.delete('/:id', async (req,res,next) => { try { res.json(await s.del(req.params.id, q(req))); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
module.exports = r;
