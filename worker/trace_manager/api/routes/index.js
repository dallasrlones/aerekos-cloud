const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { SpanStore } = require('../services/SpanStore');
const service = new ItemService();
const spans = new SpanStore();
const router = express.Router();

function wrap(fn) {
  return async (req, res, next) => {
    try { await fn(req, res); } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  };
}

async function ingestTraces(req, res, next) {
  try {
    const pid = projectId(req) || req.body?.project_id || 'default';
    const out = spans.ingest(req.body || {}, pid);
    const traces = new Map();
    for (const s of out.spans) {
      if (!traces.has(s.trace_id)) traces.set(s.trace_id, []);
      traces.get(s.trace_id).push(s);
    }
    for (const [traceId, list] of traces) {
      const name = traceId || `trace-${Date.now()}`;
      const existing = await service.list(pid).catch(() => []);
      const found = existing.find((i) => i.trace_id === traceId || i.name === name);
      const payload = { name, trace_id: traceId, spans: JSON.stringify(list.map((s) => s.span_id)) };
      if (found) await service.update(found.id, pid, payload).catch(() => {});
      else await service.create({ project_id: pid, ...payload }).catch(() => {});
    }
    res.status(200).json({ partialSuccess: {}, accepted: out.accepted });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
}

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'trace_manager',
    title: 'Traces',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'X-Ray',
    message: 'OTLP/HTTP traces'
  });
});

router.post('/v1/traces', ingestTraces);

router.get('/spans', wrap(async (req, res) => {
  res.json({ spans: spans.list({
    project_id: projectId(req),
    trace_id: req.query.trace_id,
    name: req.query.name,
    limit: req.query.limit,
  }) });
}));

router.get('/query', wrap(async (req, res) => {
  res.json({ spans: spans.list({
    project_id: projectId(req),
    trace_id: req.query.trace_id || req.query.q,
    name: req.query.name,
    limit: req.query.limit,
  }) });
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'trace_manager'));
router.use('/traces', crudRouter(service));
module.exports = { router, service, ingestTraces };
