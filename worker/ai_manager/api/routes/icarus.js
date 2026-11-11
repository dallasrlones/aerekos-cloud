'use strict';

const express = require('express');
const { requireAuth } = require('../../../shared/authManagerClient');
const { forProject } = require('../services/IcarusFacade');
const { AgentService } = require('../services/AgentService');

const r = express.Router();
const agents = new AgentService();
r.use(requireAuth());

const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

function err(res, e, next) {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  return next(e);
}

async function facade(req) {
  const projectId = q(req);
  if (!projectId) {
    const e = new Error('project_id required');
    e.status = 400;
    throw e;
  }
  const settings = await agents.getSettings(projectId);
  const f = forProject(projectId, settings);
  await f.boot();
  return f;
}

r.get('/status', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({
      project_id: f.projectId,
      gateway: f.gateway().snapshot(),
      charter: f.charter.get(f.projectId),
      energy: f.energy.route(f.projectId, { lane: 'manager' }),
      ux: f.uxSlo.summary(),
      lora: f.loraTrain.targets(),
      prs: f.prReviews.list(f.projectId).slice(0, 10),
    });
  } catch (e) { err(res, e, next); }
});

r.post('/gate', async (req, res, next) => {
  try {
    const f = await facade(req);
    const text = String(req.body?.text || req.body?.message || '');
    const out = await f.gate.route(text, { hasLivePlan: Boolean(req.body?.has_live_plan) });
    f.uxSlo.record('gate_classify_ms', 0, { route: out.route });
    res.json(out);
  } catch (e) { err(res, e, next); }
});

r.get('/plans', async (req, res, next) => {
  try {
    const f = await facade(req);
    let items = await f.graph.listPlans();
    const status = req.query.status;
    if (status) {
      const want = String(status).split(',').map((s) => s.trim());
      items = items.filter((p) => want.includes(p.status));
    }
    res.json({ items });
  } catch (e) { err(res, e, next); }
});

r.post('/plans', async (req, res, next) => {
  try {
    const f = await facade(req);
    const plan = await f.graph.createPlan(req.body || {});
    res.status(201).json({ item: plan });
  } catch (e) { err(res, e, next); }
});

r.get('/plans/:id', async (req, res, next) => {
  try {
    const f = await facade(req);
    const sub = await f.graph.subgraph(req.params.id);
    res.json(sub);
  } catch (e) { err(res, e, next); }
});

r.post('/plans/:id/tasks', async (req, res, next) => {
  try {
    const f = await facade(req);
    const task = await f.graph.addTask(req.params.id, req.body || {});
    res.status(201).json({ item: task });
  } catch (e) { err(res, e, next); }
});

r.post('/tasks/:id/status', async (req, res, next) => {
  try {
    const f = await facade(req);
    const task = await f.graph.setTaskStatus(req.params.id, req.body?.status, req.body || {});
    res.json({ item: task });
  } catch (e) { err(res, e, next); }
});

r.get('/tasks/:id/trace', async (req, res, next) => {
  try {
    const f = await facade(req);
    const { taskTrace } = require('../services/TaskTraceService');
    const trace = await taskTrace(f, req.params.id, {
      agents,
      projectId: f.projectId,
      agentId: req.query.agent_id || '',
    });
    res.json(trace);
  } catch (e) { err(res, e, next); }
});

r.get('/plans/:id/scrub', async (req, res, next) => {
  try {
    const f = await facade(req);
    const sub = await f.graph.subgraph(req.params.id);
    const at = req.query.at != null ? Number(req.query.at) : null;
    const { scrubSubgraph } = require('../services/TaskTraceService');
    res.json(scrubSubgraph(sub, at));
  } catch (e) { err(res, e, next); }
});

r.post('/tasks/link', async (req, res, next) => {
  try {
    const f = await facade(req);
    const { from, to, type } = req.body || {};
    if (type === 'BEFORE') await f.graph.linkBefore(from, to);
    else if (type === 'PARALLEL') await f.graph.linkParallel(from, to);
    else if (type === 'MUTEX') await f.graph.linkMutex(from, to);
    else if (type === 'INVALIDATES') await f.graph.invalidate(from, to, req.body?.reason || '');
    else {
      const e = new Error('type must be BEFORE|PARALLEL|MUTEX|INVALIDATES');
      e.status = 400;
      throw e;
    }
    res.json({ ok: true });
  } catch (e) { err(res, e, next); }
});

r.get('/ready', async (req, res, next) => {
  try {
    const f = await facade(req);
    const t0 = Date.now();
    const items = await f.graph.readySet(req.query.plan_id || null);
    f.uxSlo.record('graph_ready_query_ms', Date.now() - t0);
    res.json({ items });
  } catch (e) { err(res, e, next); }
});

r.post('/schedule', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json(await f.scheduler.tick(req.body?.plan_id || null));
  } catch (e) { err(res, e, next); }
});

r.post('/query', async (req, res, next) => {
  try {
    const f = await facade(req);
    const rows = await f.graph.queryUser({
      cypher: req.body?.cypher || req.body?.q,
      params: req.body?.params || {},
    });
    res.json({ rows });
  } catch (e) { err(res, e, next); }
});

r.get('/ledger', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ items: f.ledger.list(f.projectId, { limit: Number(req.query.limit) || 50 }) });
  } catch (e) { err(res, e, next); }
});

r.get('/explain/task/:id', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json(await f.explain.whyTask(f.projectId, req.params.id));
  } catch (e) { err(res, e, next); }
});

r.post('/checkpoints', async (req, res, next) => {
  try {
    const f = await facade(req);
    const cp = await f.checkpoints.save(f.projectId, req.body || {});
    res.status(201).json({ item: cp });
  } catch (e) { err(res, e, next); }
});

r.get('/checkpoints', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ items: f.checkpoints.list(f.projectId) });
  } catch (e) { err(res, e, next); }
});

r.post('/checkpoints/:id/restore', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ item: await f.checkpoints.restore(f.projectId, req.params.id) });
  } catch (e) { err(res, e, next); }
});

r.get('/charter', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ item: f.charter.get(f.projectId) });
  } catch (e) { err(res, e, next); }
});

r.patch('/charter', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ item: f.charter.set(f.projectId, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.get('/prs', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ items: f.prReviews.list(f.projectId, { status: req.query.status }) });
  } catch (e) { err(res, e, next); }
});

r.post('/prs/:id/approve', async (req, res, next) => {
  try {
    const f = await facade(req);
    const agent = await agents.resolve(f.projectId, req.body?.agent_id || req.query.agent_id);
    const settings = await agents.getSettings(f.projectId);
    f.prReviews.jobs = null;
    const pr = await f.prReviews.approveWithHigherModel({
      projectId: f.projectId, agent, prId: req.params.id, settings,
    });
    res.json({ item: pr });
  } catch (e) { err(res, e, next); }
});

r.post('/lora/propose', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json(f.loraTrain.propose({ projectId: f.projectId, ...(req.body || {}) }));
  } catch (e) { err(res, e, next); }
});

r.post('/lora/enqueue', async (req, res, next) => {
  try {
    const f = await facade(req);
    const job = f.loraTrain.enqueue({ projectId: f.projectId, ...(req.body || {}) });
    res.status(201).json({ item: job });
  } catch (e) { err(res, e, next); }
});

r.get('/lora/jobs', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ items: f.loraTrain.list(f.projectId), targets: f.loraTrain.targets() });
  } catch (e) { err(res, e, next); }
});

r.post('/teach/start', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.status(201).json({ item: f.teach.start(f.projectId, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/teach/:id/step', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ item: f.teach.addStep(req.params.id, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/teach/:id/finish', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ item: f.teach.finish(req.params.id) });
  } catch (e) { err(res, e, next); }
});

r.get('/world', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ items: f.world.recent(f.projectId) });
  } catch (e) { err(res, e, next); }
});

r.post('/world', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.status(201).json({ item: await f.world.ingest(f.projectId, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.get('/skills', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ items: f.skills.list({ kind: req.query.kind }) });
  } catch (e) { err(res, e, next); }
});

r.post('/skills', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.status(201).json({ item: f.skills.upsert(req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/marketplace/publish', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.status(201).json({
      item: f.marketplace.publish({ projectId: f.projectId, ...(req.body || {}) }),
    });
  } catch (e) { err(res, e, next); }
});

r.get('/marketplace', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json({ items: f.marketplace.list({ visibility: req.query.visibility }) });
  } catch (e) { err(res, e, next); }
});

r.get('/ux', async (req, res, next) => {
  try {
    const f = await facade(req);
    res.json(f.uxSlo.summary());
  } catch (e) { err(res, e, next); }
});

module.exports = r;
