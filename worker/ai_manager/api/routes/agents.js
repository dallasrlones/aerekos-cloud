'use strict';

const express = require('express');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');
const { AgentService } = require('../services/AgentService');
const { AgentSetupService } = require('../services/AgentSetupService');
const { AgentRuntime } = require('../services/AgentRuntime');

const r = express.Router();
const agents = new AgentService();
const setup = new AgentSetupService({ agents });
const runtime = new AgentRuntime({ agents });
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.use(requireAuth());

function err(res, e, next) {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code }, ask: e.ask });
  return next(e);
}

r.get('/setup/status', async (req, res, next) => {
  try { res.json(await setup.status(q(req))); } catch (e) { err(res, e, next); }
});

r.post('/setup', async (req, res, next) => {
  try {
    const out = await setup.apply(q(req), req.body || {});
    res.status(201).json(out);
  } catch (e) { err(res, e, next); }
});

r.get('/settings', async (req, res, next) => {
  try { res.json({ item: await agents.getSettings(q(req)) }); } catch (e) { err(res, e, next); }
});

r.patch('/settings', async (req, res, next) => {
  try { res.json({ item: await agents.updateSettings(q(req), req.body || {}) }); } catch (e) { err(res, e, next); }
});

r.get('/fleet', async (req, res, next) => {
  try { res.json(await agents.fleet(q(req))); } catch (e) { err(res, e, next); }
});

r.post('/resume', async (req, res, next) => {
  try { res.json(await runtime.resume(q(req))); } catch (e) { err(res, e, next); }
});

r.post('/', async (req, res, next) => {
  try {
    const item = await agents.create({ ...req.body, project_id: q(req) });
    res.status(201).json({ item });
  } catch (e) { err(res, e, next); }
});

r.get('/', async (req, res, next) => {
  try { res.json({ items: await agents.list(q(req)) }); } catch (e) { err(res, e, next); }
});

r.get('/:id', async (req, res, next) => {
  try { res.json({ item: await agents.resolve(q(req), req.params.id) }); } catch (e) { err(res, e, next); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ item: await agents.update(cur.id, q(req), req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.del(cur.id, q(req)));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/chat', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.status(202).json(await runtime.chat(q(req), cur.id, req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/voice', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.status(202).json(await runtime.voice(q(req), cur.id, req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/interrupt', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await runtime.interrupt(q(req), cur.id, req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/approve', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await runtime.approve(q(req), cur.id, req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/pulse', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.pulse(q(req), cur.id));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/messages', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listMessages(q(req), cur.id, req.query) });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/pins', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listPins(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/pins', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.status(201).json({ item: await agents.pin(q(req), cur.id, req.body?.key, req.body?.value) });
  } catch (e) { err(res, e, next); }
});

r.delete('/:id/pins/:key', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.forgetPin(q(req), cur.id, req.params.key));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/memory/export', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.exportMemory(q(req), cur.id));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/memory/wipe', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.wipeMemory(q(req), cur.id));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/rolls', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ rolls: await agents.getRolls(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/rolls/refresh', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ rolls: await runtime.refreshRolls(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/plans', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    if (typeof runtime.plans.ensureLoaded === 'function') {
      await runtime.plans.ensureLoaded(q(req), cur.id);
    }
    res.json({ items: runtime.plans.list(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/plans/:planId', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    if (typeof runtime.plans.ensureLoaded === 'function') {
      await runtime.plans.ensureLoaded(q(req), cur.id);
    }
    const item = runtime.plans.get(q(req), cur.id, req.params.planId);
    if (!item) return res.status(404).json({ error: { message: 'plan not found' } });
    const work = await agents.listWork(q(req), cur.id);
    const asks = await agents.listAsks(q(req), cur.id);
    const payloadOf = (w) => {
      try { return typeof w.payload === 'string' ? JSON.parse(w.payload || '{}') : (w.payload || {}); } catch { return {}; }
    };
    const askPayload = (a) => {
      try { return typeof a.payload === 'string' ? JSON.parse(a.payload || '{}') : (a.payload || {}); } catch { return {}; }
    };
    res.json({
      item,
      work: work.filter((w) => payloadOf(w).plan_id === item.id),
      asks: asks.filter((a) => askPayload(a).plan_id === item.id),
    });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/console-events', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await runtime.ingestConsoleEvents(q(req), cur.id, req.body?.events || []));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/work', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listWork(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/work', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.status(201).json({ item: await agents.createWork(q(req), cur.id, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/work/reorder', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.reorderWork(q(req), cur.id, req.body?.ids || []) });
  } catch (e) { err(res, e, next); }
});

r.patch('/:id/work/:workId', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    await agents.resolve(q(req), req.params.id);
    res.json({ item: await agents.updateWork(req.params.workId, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/prompts', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.getPrompts(q(req), cur.id));
  } catch (e) { err(res, e, next); }
});

r.patch('/:id/prompts', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.patchPrompts(q(req), cur.id, req.body?.prompts || req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/prompts/reset', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.resetPrompts(q(req), cur.id));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/browser/frames/:frameId', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    const Browser = require('../services/BrowserSession');
    const row = Browser.requireFrame(q(req), cur.id, req.params.frameId);
    if (row.bytes) {
      res.setHeader('Content-Type', 'image/jpeg');
      return res.send(row.bytes);
    }
    res.status(404).json({ error: { message: 'frame not found' } });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/prs/:prId/diff', async (req, res, next) => {
  try {
    await agents.resolve(q(req), req.params.id);
    const work = await agents.listWork(q(req), (await agents.resolve(q(req), req.params.id)).id);
    const item = work.find((w) => w.id === req.params.prId);
    const payload = item ? (typeof item.payload === 'string' ? JSON.parse(item.payload || '{}') : item.payload) : {};
    res.json({ id: req.params.prId, diff: payload.diff || runtime.prDiff(req.params.prId) || '' });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/asks', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listAsks(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/timeline', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listTimeline(q(req), cur.id, { since: req.query.since }) });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/workers', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listWorkers(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/workers', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.status(201).json({ item: await runtime.spawnWorker(q(req), cur.id, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/workers/:wid/run', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await runtime.runWorker(q(req), cur.id, req.params.wid, req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/cron', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listCron(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/cron', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.status(201).json({ item: await agents.createCron(q(req), cur.id, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/cron/:cid/fire', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    const fired = await runtime.fireCron(q(req), cur.id, req.params.cid);
    res.json(fired);
  } catch (e) { err(res, e, next); }
});

r.post('/:id/claim', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.claimWorktree(q(req), cur.id, req.body?.worker_id, req.body?.claim_prefix));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/message', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await agents.sendInter(q(req), cur.id, req.body?.to || req.body?.to_agent_id, req.body?.content));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/compact', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await runtime.compact(q(req), cur.id));
  } catch (e) { err(res, e, next); }
});

r.get('/:id/skills', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listSkills(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.post('/:id/skills', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.status(201).json({ item: await agents.createSkill(q(req), cur.id, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/audit', async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json({ items: await agents.listAudit(q(req), cur.id) });
  } catch (e) { err(res, e, next); }
});

r.get('/:id/fs', async (req, res, next) => {
  try { res.json(await runtime.fsList(q(req), req.query.path || '.')); } catch (e) { err(res, e, next); }
});

r.post('/:id/fs', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await runtime.fsWrite(q(req), cur.id, { ...req.body, actor: req.user?.id || 'console' }));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/term', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await runtime.term(q(req), cur.id, { cmd: req.body?.cmd, actor: req.user?.id || 'console' }));
  } catch (e) { err(res, e, next); }
});

r.post('/:id/tools', requireResource({ requiredScope: 'ai:InvokeAgent' }), async (req, res, next) => {
  try {
    const cur = await agents.resolve(q(req), req.params.id);
    res.json(await runtime.executeApprovedTool(q(req), cur.id, {
      name: req.body?.name, args: req.body?.args || {}, actor: req.user?.id || 'console',
    }));
  } catch (e) { err(res, e, next); }
});

module.exports = r;
