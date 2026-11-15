const express = require('express');
const { TaskService } = require('../services/TaskService');
const { enrichTask } = require('../services/TaskArn');

const router = express.Router();
const service = new TaskService();

router.use((req, _res, next) => {
  if (service.fleet && typeof service.fleet.useToken === 'function') {
    service.fleet.useToken(req.headers.authorization || '');
  }
  next();
});

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function serialize(t) {
  let command = [];
  let env = {};
  let port_bindings = {};
  try {
    command = t.command ? JSON.parse(t.command) : [];
  } catch (e) {
    /* ignore */
  }
  try {
    env = t.env ? JSON.parse(t.env) : {};
  } catch (e) {
    /* ignore */
  }
  try {
    port_bindings = t.port_bindings ? JSON.parse(t.port_bindings) : {};
  } catch (e) {
    /* ignore */
  }
  let volumes = [];
  try {
    volumes = t.volumes ? JSON.parse(t.volumes) : [];
  } catch (e) {
    /* ignore */
  }
  const base = {
    id: t.id,
    name: t.name,
    project_id: t.project_id,
    image: t.image,
    command,
    env,
    port_bindings,
    volumes,
    run_mode: t.run_mode,
    status: t.status,
    container_id: t.container_id,
    exit_code: t.exit_code === -1 ? null : t.exit_code,
    error_message: t.error_message || null,
    desired: t.desired == null ? 1 : Number(t.desired),
    balancer_id: t.balancer_id || '',
    database_name: t.database_name || '',
    pin_worker_id: t.pin_worker_id || '',
    worker_id: t.worker_id || '',
    worker_hostname: t.worker_hostname || '',
    environment: t.environment || 'prod',
    network: t.network || '',
    arn: t.arn || `arn:aerekos:${t.project_id}:compute:task/${t.name}`,
    created_at: t.created_at,
    updated_at: t.updated_at
  };
  return enrichTask(base);
}

router.post('/adopt', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: getProjectId(req) || req.body.project_id };
    const row = await service.adoptTask(body);
    res.status(201).json({ task: serialize(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: getProjectId(req) || req.body.project_id };
    const row = await service.createTask(body);
    res.status(201).json({ task: serialize(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const list = await service.list(getProjectId(req), req.query.environment || req.query.env);
    res.json({ tasks: list.map(serialize) });
  } catch (e) {
    if (e.status === 400) {
      return res.status(400).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const row = await service.updateTask(req.params.id, getProjectId(req), req.body || {});
    res.json({ task: serialize(row) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    const row = await service.startTask(req.params.id, getProjectId(req));
    res.json({ task: serialize(row) });
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/:id/replace-image', async (req, res, next) => {
  try {
    const row = await service.replaceImage(req.params.id, getProjectId(req), req.body?.image, {
      force: req.body?.force === true,
      pin_worker_id: req.body?.pin_worker_id,
    });
    res.json({ task: serialize(row) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.post('/:id/restart', async (req, res, next) => {
  try {
    const row = await service.restartTask(req.params.id, getProjectId(req));
    res.json({ task: serialize(row) });
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/:id/health', async (req, res, next) => {
  try {
    res.json(await service.health(req.params.id, getProjectId(req)));
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/:id/stop', async (req, res, next) => {
  try {
    const row = await service.stopTask(req.params.id, getProjectId(req));
    res.json({ task: serialize(row) });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.patch('/:id/scale', async (req, res, next) => {
  try {
    const row = await service.scaleTask(req.params.id, getProjectId(req), req.body?.desired, req.body || {});
    res.json({ task: serialize(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.post('/:id/attach-database', async (req, res, next) => {
  try {
    const row = await service.attachDatabase(req.params.id, getProjectId(req), req.body?.database_name);
    res.json({ task: serialize(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/:id/stats', async (req, res, next) => {
  try {
    res.json(await service.stats(req.params.id, getProjectId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/:id/logs', async (req, res, next) => {
  try {
    const out = await service.logs(req.params.id, getProjectId(req), req.query.tail);
    res.json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const row = refresh
      ? await service.getByIdRefreshed(req.params.id, getProjectId(req))
      : await service.getById(req.params.id, getProjectId(req));
    res.json({ task: serialize(row) });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await service.deleteTask(req.params.id, getProjectId(req));
    res.json(r);
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

module.exports = router;
