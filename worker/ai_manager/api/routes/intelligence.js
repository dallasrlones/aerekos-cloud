'use strict';

const express = require('express');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');
const { IntelligenceService } = require('../services/IntelligenceService');
const { IntelligenceChatService } = require('../services/IntelligenceChatService');
const { IntelligenceJobService } = require('../services/IntelligenceJobService');

const r = express.Router();
const svc = new IntelligenceService();
const chat = new IntelligenceChatService({ intel: svc });
const jobs = new IntelligenceJobService({ intel: svc, chat });
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.use(requireAuth());

function err(res, e, next) {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  return next(e);
}

r.post('/chat', requireResource({ requiredScope: 'ai:InvokeIntelligence' }), async (req, res, next) => {
  try {
    const pid = q(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    const endpoint = await chat.resolveEndpoint(pid, req);
    if ((endpoint.execution || 'sync') === 'queued') {
      return res.status(409).json({
        error: { message: 'use the jobs API', code: 'queued_endpoint' },
        hint: 'POST /api/v1/intelligence/jobs',
      });
    }
    res.json(await chat.chat(pid, req));
  } catch (e) { err(res, e, next); }
});

r.post('/jobs', requireResource({ requiredScope: 'ai:InvokeIntelligence' }), async (req, res, next) => {
  try {
    const pid = q(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    const job = await jobs.submit(pid, req.body || {});
    res.status(201).json({ job, status: job.status });
  } catch (e) { err(res, e, next); }
});

r.get('/jobs', requireResource({ requiredScope: 'ai:InvokeIntelligence' }), async (req, res, next) => {
  try {
    const pid = q(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    res.json({ items: await jobs.list(pid, req.query) });
  } catch (e) { err(res, e, next); }
});

r.get('/jobs/:id', requireResource({ requiredScope: 'ai:InvokeIntelligence' }), async (req, res, next) => {
  try {
    const pid = q(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    res.json({ job: await jobs.get(req.params.id, pid) });
  } catch (e) { err(res, e, next); }
});

r.post('/jobs/:id/cancel', requireResource({ requiredScope: 'ai:InvokeIntelligence' }), async (req, res, next) => {
  try {
    const pid = q(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    res.json({ job: await jobs.cancel(req.params.id, pid) });
  } catch (e) { err(res, e, next); }
});

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

r.get('/usage', async (req, res, next) => {
  try {
    const { UsageService } = require('../services/UsageService');
    const usage = new UsageService();
    res.json(await usage.list(q(req), {
      user_id: req.query.user_id,
      endpoint_name: req.query.endpoint_name,
      limit: req.query.limit,
      offset: req.query.offset,
    }));
  } catch (e) { err(res, e, next); }
});

r.delete('/usage', async (req, res, next) => {
  try {
    const { UsageService } = require('../services/UsageService');
    const usage = new UsageService();
    res.json(await usage.delForProject(q(req)));
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

r.post('/:id/attach', async (req, res, next) => {
  try {
    res.json({ item: await svc.attach(req.params.id, q(req), req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/detach', async (req, res, next) => {
  try {
    res.json({ item: await svc.detach(req.params.id, q(req), req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/attach-balancer', async (req, res, next) => {
  try {
    res.json({ item: await svc.update(req.params.id, q(req), { balancer_id: req.body?.balancer_id || req.body?.id }) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/detach-balancer', async (req, res, next) => {
  try {
    res.json({ item: await svc.update(req.params.id, q(req), { balancer_id: '' }) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/chat', requireResource({ requiredScope: 'ai:InvokeIntelligence' }), async (req, res, next) => {
  try {
    const pid = q(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    req.params = { ...req.params };
    const endpoint = await chat.resolveEndpoint(pid, req);
    if ((endpoint.execution || 'sync') === 'queued') {
      return res.status(409).json({
        error: { message: 'use the jobs API', code: 'queued_endpoint' },
        hint: 'POST /api/v1/intelligence/jobs',
      });
    }
    res.json(await chat.chat(pid, req));
  } catch (e) { err(res, e, next); }
});

module.exports = r;
