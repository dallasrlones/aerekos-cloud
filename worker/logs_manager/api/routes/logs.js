const express = require('express');
const { LogEventService } = require('../services/LogEventService');
const { liveEmitSoon } = require('../../../shared/liveEmit');

const router = express.Router();
const service = new LogEventService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function serialize(r) {
  let contextObj = null;
  if (r.context) {
    try {
      contextObj = JSON.parse(r.context);
    } catch {
      contextObj = r.context;
    }
  }
  return {
    id: r.id,
    project_id: r.project_id,
    source: r.source,
    level: r.level,
    message: r.message,
    context: contextObj,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

router.post('/logs', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: getProjectId(req) || req.body.project_id };
    const row = await service.create(body);
    const log = serialize(row);
    liveEmitSoon(`logs:${log.source}`, 'log:appended', {
      project_id: log.project_id,
      source: log.source,
      logs: [log],
    });
    res.status(201).json({ log });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.post('/logs/batch', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: getProjectId(req) || req.body.project_id };
    const rows = await service.createBatch(body);
    const logs = rows.map(serialize);
    const bySource = new Map();
    for (const log of logs) {
      if (!bySource.has(log.source)) bySource.set(log.source, []);
      bySource.get(log.source).push(log);
    }
    for (const [source, group] of bySource) {
      liveEmitSoon(`logs:${source}`, 'log:appended', {
        project_id: body.project_id,
        source,
        logs: group,
      });
    }
    res.status(201).json({ logs, count: logs.length });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const list = await service.list(getProjectId(req), {
      level: req.query.level,
      since: req.query.since,
      until: req.query.until,
      source: req.query.source,
      q: req.query.q,
      limit: req.query.limit
    });
    res.json({ logs: list.map(serialize) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.get('/logs/:id', async (req, res, next) => {
  try {
    const row = await service.getById(req.params.id, getProjectId(req));
    res.json({ log: serialize(row) });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.post('/logs/compact', async (req, res, next) => {
  try {
    res.json(await service.compact(getProjectId(req), { olderThanDays: req.body?.older_than_days }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.delete('/logs/:id', async (req, res, next) => {
  try {
    res.json(await service.deleteById(req.params.id, getProjectId(req)));
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

module.exports = router;
