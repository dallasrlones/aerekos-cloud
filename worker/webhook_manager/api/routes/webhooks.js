const express = require('express');
const { WebhookService } = require('../services/WebhookService');

const router = express.Router();
const svc = new WebhookService();

function qProject(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function epOut(r) {
  return {
    id: r.id,
    project_id: r.project_id,
    name: r.name,
    target_url: r.target_url,
    secret_set: !!(r.secret && String(r.secret).length),
    headers: r.headers || null,
    enabled: r.enabled !== '0',
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function delOut(d) {
  return {
    id: d.id,
    project_id: d.project_id,
    endpoint_id: d.endpoint_id,
    status: d.status,
    http_status: d.http_status,
    error: d.error || null,
    response_snippet: d.response_snippet || null,
    created_at: d.created_at
  };
}

router.post('/', async (req, res, next) => {
  try {
    const created = await svc.createEndpoint({ ...req.body, project_id: req.body.project_id || qProject(req) });
    res.status(201).json({ webhook: epOut(created) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const rows = await svc.listEndpoints(qProject(req));
    res.json({ webhooks: rows.map(epOut) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await svc.getEndpoint(req.params.id, qProject(req));
    res.json({ webhook: epOut(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

const updateHandler = async (req, res, next) => {
  try {
    const row = await svc.updateEndpoint(req.params.id, qProject(req), req.body || {});
    res.json({ webhook: epOut(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
};
router.patch('/:id', updateHandler);
router.put('/:id', updateHandler);

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await svc.deleteEndpoint(req.params.id, qProject(req));
    res.json(r);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.post('/:id/dispatch', async (req, res, next) => {
  try {
    const { delivery, mode } = await svc.dispatch(req.params.id, qProject(req), req.body);
    res.status(201).json({ delivery: delOut(delivery), mode });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.get('/:id/deliveries', async (req, res, next) => {
  try {
    const rows = await svc.listDeliveries(qProject(req), req.params.id);
    res.json({ deliveries: rows.map(delOut) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message } });
    }
    next(e);
  }
});

module.exports = router;
