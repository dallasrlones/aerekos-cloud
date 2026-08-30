'use strict';

const express = require('express');
const axios = require('axios');
const { MetricAlarmService } = require('../services/MetricAlarmService');

const r = express.Router();
const s = new MetricAlarmService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.post('/', async (req,res,next) => { try { const o = await s.create({ ...req.body, project_id: q(req) }); res.status(201).json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/', async (req,res,next) => { try { const o = await s.list(q(req)); res.json({ items: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/:id', async (req,res,next) => { try { const o = await s.get(req.params.id, q(req)); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
const upd = async (req,res,next) => { try { const o = await s.update(req.params.id, q(req), req.body || {}); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } };
r.patch('/:id', upd);
r.put('/:id', upd);
r.delete('/:id', async (req,res,next) => { try { res.json(await s.del(req.params.id, q(req))); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });

async function fireEvent(projectId, alarm, value) {
  if (process.env.SKIP_OUTBOUND === '1' || process.env.SKIP_OUTBOUND === 'true') {
    return { skipped: true };
  }
  const conductor = process.env.CONDUCTOR_URL;
  const token = process.env.CONDUCTOR_TOKEN || process.env.SERVICE_TOKEN;
  if (!conductor || !token) return { skipped: true, reason: 'no_conductor' };
  try {
    await axios.post(
      `${conductor.replace(/\/$/, '')}/api/services/event_manager/api/v1/events`,
      {
        project_id: projectId,
        type: 'metrics.alarm',
        bus: 'aerekos.fleet',
        source: 'metrics_manager',
        payload: { alarm: alarm.name, metric: alarm.metric_name, value, threshold: alarm.threshold, op: alarm.op },
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 },
    );
    return { published: true };
  } catch (e) {
    return { published: false, error: e.message };
  }
}

r.post('/evaluate', async (req, res, next) => {
  try {
    const pid = q(req);
    const alarms = pid ? await s.list(pid) : [];
    const value = Number(req.body?.value ?? 0);
    const metric = req.body?.metric_name;
    const fired = [];
    for (const a of alarms) {
      if (a.enabled === 'false') continue;
      if (metric && a.metric_name && a.metric_name !== metric) continue;
      const th = Number(a.threshold || 0);
      const hit = a.op === 'lt' ? value < th : value > th;
      if (hit) {
        fired.push({ name: a.name, publish: await fireEvent(pid, a, value) });
      }
    }
    res.json({ fired, value, skipped: process.env.SKIP_OUTBOUND === '1' });
  } catch (e) { next(e); }
});

module.exports = r;
