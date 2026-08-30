const express = require('express');
const { DnsRecordService } = require('../services/DnsRecordService');

const router = express.Router();
const service = new DnsRecordService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function serialize(r) {
  return {
    id: r.id,
    project_id: r.project_id,
    zone_id: r.zone_id,
    name: r.record_name,
    type: r.record_type,
    content: r.content,
    ttl: r.ttl,
    proxied: !!r.proxied,
    cf_record_id: r.cf_record_id,
    last_error: r.last_error || null,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

router.post('/records', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: getProjectId(req) || req.body.project_id };
    const row = await service.create(body);
    res.status(201).json({ record: serialize(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code, cf: e.cf } });
    }
    next(e);
  }
});

router.get('/records', async (req, res, next) => {
  try {
    const list = await service.list(getProjectId(req), req.query.zone_id);
    res.json({ records: list.map(serialize) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/records/:id', async (req, res, next) => {
  try {
    const row = await service.getById(req.params.id, getProjectId(req));
    res.json({ record: serialize(row) });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.patch('/records/:id', async (req, res, next) => {
  try {
    const row = await service.update(req.params.id, getProjectId(req), req.body);
    res.json({ record: serialize(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.delete('/records/:id', async (req, res, next) => {
  try {
    const r = await service.deleteById(req.params.id, getProjectId(req));
    res.json(r);
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

module.exports = router;
