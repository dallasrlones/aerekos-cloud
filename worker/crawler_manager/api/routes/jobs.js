const express = require('express');
const { CrawlJobService } = require('../services/CrawlJobService');
const r = express.Router();
const s = new CrawlJobService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
r.post('/canary', async (req,res,next) => {
  try {
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: { message: 'url required' } });
    if (process.env.SKIP_CRAWL === '1' || process.env.SKIP_CRAWL === 'true') {
      return res.json({ ok: true, skipped: true, url, mode: 'canary' });
    }
    const axios = require('axios');
    const started = Date.now();
    const r0 = await axios.get(url, { timeout: 5000, maxRedirects: 3, validateStatus: () => true });
    res.json({ ok: r0.status < 500, status: r0.status, ms: Date.now() - started, url, mode: 'canary' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});
r.post('/', async (req,res,next) => { try { const o = await s.create({ ...req.body, project_id: q(req) }); res.status(201).json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/', async (req,res,next) => { try { const o = await s.list(q(req)); res.json({ items: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/:id', async (req,res,next) => { try { const o = await s.get(req.params.id, q(req)); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
const upd = async (req,res,next) => { try { const o = await s.update(req.params.id, q(req), req.body || {}); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } };
r.patch('/:id', upd);
r.put('/:id', upd);
r.post('/:id/run', async (req,res,next) => {
  try { res.json({ item: await s.run(req.params.id, q(req)) }); }
  catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); }
});
r.delete('/:id', async (req,res,next) => { try { res.json(await s.del(req.params.id, q(req))); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
module.exports = r;
