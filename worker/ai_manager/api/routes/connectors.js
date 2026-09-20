'use strict';

const express = require('express');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');
const { ConnectorService } = require('../services/ConnectorService');
const { AgentService } = require('../services/AgentService');

const r = express.Router();
const svc = new ConnectorService();
const agents = new AgentService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.use(requireAuth());

function err(res, e, next) {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code }, ask: e.ask });
  return next(e);
}

r.get('/kinds', (_req, res) => {
  res.json({ items: svc.kinds() });
});

r.post('/', async (req, res, next) => {
  try {
    const item = await svc.create({ ...req.body, project_id: q(req) });
    res.status(201).json({ item });
  } catch (e) { err(res, e, next); }
});

r.get('/', async (req, res, next) => {
  try { res.json({ items: await svc.list(q(req)) }); } catch (e) { err(res, e, next); }
});

r.post('/invoke', requireResource({ requiredScope: 'ai:InvokeConnector' }), async (req, res, next) => {
  try {
    const pid = q(req);
    const result = await svc.invoke(pid, req.body || {}, {
      audit: (row) => agents.audit(pid, req.body?.agent_id || '', { actor: req.user?.id || 'app', ...row }),
    });
    res.json({ result });
  } catch (e) { err(res, e, next); }
});

r.get('/:id', async (req, res, next) => {
  try { res.json({ item: await svc.resolve(q(req), req.params.id) }); } catch (e) { err(res, e, next); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const cur = await svc.resolve(q(req), req.params.id);
    res.json({ item: await svc.update(cur.id, q(req), req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    const cur = await svc.resolve(q(req), req.params.id);
    res.json(await svc.del(cur.id, q(req)));
  } catch (e) { err(res, e, next); }
});

module.exports = r;
