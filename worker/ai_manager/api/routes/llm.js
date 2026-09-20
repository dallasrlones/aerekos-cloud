const express = require('express');
const { resolveOllama } = require('../services/llmResolve');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');
const { bench, kickModel } = require('../services/benchmarkRunner');
const { endpointKey, DEFAULT_SUITE } = require('../services/LlmBenchmarkService');
const { emitPull } = require('../utils/aiLive');

const r = express.Router();

async function err(res, e, next) {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  if (e && e.code === 'ECONNREFUSED') return res.status(503).json({ error: { message: 'LLM backend unreachable' } });
  return next(e);
}

r.use(requireAuth());

const pulls = new Map();

function trackPull(model) {
  const entry = { model, status: 'pulling', completed: 0, total: 0, percent: 0, error: null, started_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  pulls.set(model, entry);
  return entry;
}

r.get('/status', async (req, res, next) => {
  try {
    const svc = await resolveOllama(req);
    res.json(await svc.status());
  } catch (e) { err(res, e, next); }
});

r.get('/models', async (req, res, next) => {
  try {
    const svc = await resolveOllama(req);
    await svc.ensureRunning();
    let models = await svc.listModels();
    if (req.query.include_benchmarks === 'true' || req.query.include_benchmarks === '1') {
      const ep = endpointKey(svc);
      const suite = req.query.bench_suite || DEFAULT_SUITE;
      const results = await bench.listResults({ endpoint: ep, suite });
      const byName = new Map(results.map((b) => [b.model, b]));
      models = bench.enrichModels(models, byName);
    }
    res.json({ models });
  } catch (e) { err(res, e, next); }
});

r.get('/models/pulls', (req, res) => {
  res.json({ pulls: Array.from(pulls.values()) });
});

r.get('/models/:name', async (req, res, next) => {
  try {
    const svc = await resolveOllama(req);
    await svc.ensureRunning();
    const name = decodeURIComponent(req.params.name);
    const model = await svc.showModel(name);
    const ep = endpointKey(svc);
    const suite = req.query.bench_suite || DEFAULT_SUITE;
    const benchmark = await bench.getForModel(ep, name, suite);
    res.json({ model, benchmark });
  } catch (e) { err(res, e, next); }
});

r.post('/models/pull', async (req, res, next) => {
  const model = String(req.body?.model || req.body?.name || '').trim();
  if (!model) return res.status(400).json({ error: { message: 'model is required' } });
  const active = pulls.get(model);
  if (active && active.status === 'pulling') {
    return res.status(202).json({ status: 'pulling', model, pull: active });
  }
  const entry = trackPull(model);
  const projectId = req.body?.project_id || req.query.project_id || req.headers['x-project-id'] || '';
  try {
    const svc = await resolveOllama(req);
    if (svc.supportsModelManagement === false) {
      pulls.delete(model);
      return res.status(409).json({
        error: {
          message: 'Pull is not supported on vLLM. Load a Hugging Face id on the endpoint (apply recreates aerekos-vllm).',
          code: 'not_supported_for_vllm',
        },
      });
    }
    await svc.ensureRunning();
    emitPull(entry, projectId, true);
    svc.pullModel(model, (p) => {
      entry.updated_at = new Date().toISOString();
      if (typeof p.total === 'number') entry.total = p.total;
      if (typeof p.completed === 'number') entry.completed = p.completed;
      if (entry.total > 0) entry.percent = Math.round((entry.completed / entry.total) * 100);
      if (p.status) entry.detail = p.status;
      if (p.error) { entry.status = 'error'; entry.error = p.error; }
      emitPull(entry, projectId, Boolean(p.error));
    })
      .then(() => {
        if (entry.status !== 'error') {
          entry.status = 'success';
          entry.percent = 100;
          kickModel(model, svc);
        }
        entry.updated_at = new Date().toISOString();
        emitPull(entry, projectId, true);
      })
      .catch((e) => {
        entry.status = 'error';
        entry.error = e.message;
        entry.updated_at = new Date().toISOString();
        emitPull(entry, projectId, true);
      });
    res.status(202).json({ status: 'pulling', model, pull: entry });
  } catch (e) { pulls.delete(model); err(res, e, next); }
});

r.delete('/models/:name', async (req, res, next) => {
  try {
    const svc = await resolveOllama(req);
    if (svc.supportsModelManagement === false) {
      return res.status(409).json({
        error: {
          message: 'Delete is not supported on vLLM. Change the served model by editing the endpoint and restarting vLLM.',
          code: 'not_supported_for_vllm',
        },
      });
    }
    await svc.ensureRunning();
    res.json(await svc.deleteModel(decodeURIComponent(req.params.name)));
  } catch (e) { err(res, e, next); }
});

r.get('/benchmarks', async (req, res, next) => {
  try {
    const svc = await resolveOllama(req);
    const ep = endpointKey(svc);
    const suite = req.query.suite || DEFAULT_SUITE;
    const items = await bench.listResults({ endpoint: ep, suite });
    const pending = await bench.listPending(svc, { suite });
    const passed = items.filter((i) => i.pass).sort((a, b) => (a.wall_ms || 9e9) - (b.wall_ms || 9e9));
    res.json({
      endpoint: ep,
      suite,
      run: bench.getRunState(),
      recommended: passed[0]?.model || null,
      items,
      pending: pending.map((p) => p.name),
      pending_count: pending.length,
    });
  } catch (e) { err(res, e, next); }
});

r.get('/benchmarks/status', (req, res) => {
  res.json({ run: bench.getRunState(), suite: DEFAULT_SUITE });
});

r.get('/benchmarks/pending', async (req, res, next) => {
  try {
    const svc = await resolveOllama(req);
    const ep = endpointKey(svc);
    const suite = req.query.suite || DEFAULT_SUITE;
    const pending = await bench.listPending(svc, { suite });
    res.json({ endpoint: ep, suite, pending });
  } catch (e) { err(res, e, next); }
});

r.post('/benchmarks/run', requireResource({ requiredScope: 'ai:InvokeLlm' }), async (req, res, next) => {
  try {
    const svc = await resolveOllama(req);
    const force = req.body?.force === true || req.query.force === 'true';
    const models = Array.isArray(req.body?.models) ? req.body.models : null;
    const suite = req.body?.suite || req.query.suite || DEFAULT_SUITE;
    const projectId = req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
    const result = bench.schedulePending(svc, { models, force, suite, projectId });
    res.status(result.started ? 202 : 200).json(result);
  } catch (e) { err(res, e, next); }
});

r.post('/generate', requireResource({ requiredScope: 'ai:InvokeLlm' }), async (req, res, next) => {
  const { model, prompt } = req.body || {};
  if (!model || !prompt) return res.status(400).json({ error: { message: 'model and prompt are required' } });
  try {
    const svc = await resolveOllama(req);
    await svc.ensureRunning();
    res.json(await svc.generate(req.body));
  } catch (e) { err(res, e, next); }
});

r.post('/chat', requireResource({ requiredScope: 'ai:InvokeLlm' }), async (req, res, next) => {
  const { model, messages } = req.body || {};
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'model and non-empty messages[] are required' } });
  }
  try {
    const svc = await resolveOllama(req);
    await svc.ensureRunning();
    res.json(await svc.chat(req.body));
  } catch (e) { err(res, e, next); }
});

module.exports = r;
