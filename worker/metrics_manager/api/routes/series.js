const express = require('express');
const { MetricSeriesService } = require('../services/MetricSeriesService');
const r = express.Router();
const s = new MetricSeriesService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
r.post('/', async (req,res,next) => { try { const o = await s.create({ ...req.body, project_id: q(req) }); res.status(201).json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.post('/sample', async (req,res,next) => { try { const o = await s.sample({ ...req.body, project_id: q(req) }); res.status(201).json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/', async (req,res,next) => { try { const o = await s.list(q(req), { metric_name: req.query.metric_name, task_id: req.query.task_id, limit: req.query.limit }); res.json({ items: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/:id', async (req,res,next) => { try { const o = await s.get(req.params.id, q(req)); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
const upd = async (req,res,next) => { try { const o = await s.update(req.params.id, q(req), req.body || {}); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } };
r.patch('/:id', upd);
r.put('/:id', upd);
r.delete('/:id', async (req,res,next) => { try { res.json(await s.del(req.params.id, q(req))); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.post('/scrape', async (req,res,next) => {
  try {
    const item = await s.create({
      project_id: q(req),
      name: req.body?.name || 'healthy_host_count',
      metric_name: req.body?.metric_name || 'healthy_host_count',
      value: String(req.body?.value ?? '0'),
      labels: req.body?.labels || '{}',
    });
    res.status(201).json({ item });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); }
});
module.exports = r;
