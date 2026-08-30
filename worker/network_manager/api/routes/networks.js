const express = require('express');
const { ProjectNetworkService } = require('../services/ProjectNetworkService');

const router = express.Router();
const service = new ProjectNetworkService();

function getProjectId(req) {
  return (
    req.query.project_id || req.body?.project_id || req.headers['x-project-id'] || null
  );
}

function networkOut(n) {
  return {
    id: n.id,
    project_id: n.project_id,
    name: n.name,
    docker_network_name: n.docker_network_name,
    docker_network_id: n.docker_network_id,
    driver: n.driver,
    last_error: n.last_error || null,
    created_at: n.created_at,
    updated_at: n.updated_at
  };
}

router.get('/', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const rows = await service.list(projectId);
    res.json({ networks: rows.map(networkOut) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: req.body.project_id || getProjectId(req) };
    const created = await service.create(body);
    res.status(201).json({ network: networkOut(created) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.post('/ensure-default', async (req, res, next) => {
  try {
    const row = await service.ensureDefault(getProjectId(req) || req.body?.project_id);
    res.json({ network: networkOut(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const row = await service.getById(req.params.id, projectId);
    res.json({ network: networkOut(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const result = await service.deleteById(req.params.id, projectId);
    res.json(result);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

module.exports = router;
