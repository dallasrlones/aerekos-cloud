const express = require('express');
const { TunnelService } = require('../services/TunnelService');

const router = express.Router();
const service = new TunnelService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function serialize(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    cf_tunnel_id: row.cf_tunnel_id,
    status: row.cf_status,
    last_error: row.last_error || null,
    display_name: row.display_name || '',
    device_hostname: row.device_hostname || '',
    worker_id: row.worker_id || '',
    origin_mode: row.origin_mode || 'host',
    ingress_rules: (() => {
      try {
        const raw = row.ingress_config || row.ingress_json;
        const j = raw ? JSON.parse(raw) : [];
        return Array.isArray(j) ? j.length : 0;
      } catch { return 0; }
    })(),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.post('/tunnels', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: getProjectId(req) || req.body.project_id };
    const { tunnel, token, credentials_file } = await service.create(body);
    res.status(201).json({
      tunnel: serialize(tunnel),
      token,
      credentials_file: credentials_file || null
    });
  } catch (e) {
    if (e.status) {
      return res
        .status(e.status)
        .json({ error: { message: e.message, code: e.code, cf: e.cf } });
    }
    next(e);
  }
});

router.get('/tunnels', async (req, res, next) => {
  try {
    const list = await service.list(getProjectId(req));
    res.json({ tunnels: list.map(serialize) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/tunnels/:id', async (req, res, next) => {
  try {
    const row = await service.getById(req.params.id, getProjectId(req));
    res.json({ tunnel: serialize(row) });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.delete('/tunnels/:id', async (req, res, next) => {
  try {
    const r = await service.deleteById(req.params.id, getProjectId(req));
    res.json(r);
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/tunnels/:id/ingress', async (req, res, next) => {
  try {
    res.json(await service.getIngress(req.params.id, getProjectId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.patch('/tunnels/:id/ingress', async (req, res, next) => {
  try {
    res.json(await service.mergeIngress(req.params.id, getProjectId(req), req.body || {}));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.put('/tunnels/:id/ingress', async (req, res, next) => {
  try {
    res.json(await service.setIngress(req.params.id, getProjectId(req), req.body?.ingress || req.body));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.post('/tunnels/adopt-known', async (req, res, next) => {
  try {
    res.json(await service.adoptKnown(getProjectId(req) || req.body?.project_id, req.body?.tunnels || []));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.post('/tunnels/import', async (req, res, next) => {
  try {
    res.json(await service.importFromCloudflare(getProjectId(req) || req.body?.project_id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.post('/tunnels/import-from-cloudflare', async (req, res, next) => {
  try {
    res.json(await service.importFromCloudflare(getProjectId(req) || req.body?.project_id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.post('/tunnels/reconcile', async (req, res, next) => {
  try {
    res.json(await service.reconcile(getProjectId(req) || req.body?.project_id));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

module.exports = router;
