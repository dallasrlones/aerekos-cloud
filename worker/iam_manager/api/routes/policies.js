const express = require('express');
const { IamService } = require('../services/IamService');

const router = express.Router();
const service = new IamService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function policyOut(p) {
  return {
    id: p.id,
    project_id: p.project_id,
    name: p.name,
    effect: p.effect,
    document: service.documentToJson(p.document),
    description: p.description || null,
    metadata: p.metadata || null,
    created_at: p.created_at,
    updated_at: p.updated_at
  };
}

router.post('/', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: getProjectId(req) || req.body.project_id };
    const row = await service.createPolicy(body);
    res.status(201).json({ policy: policyOut(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const list = await service.listPolicies(getProjectId(req));
    res.json({ policies: list.map(policyOut) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await service.getPolicy(req.params.id, getProjectId(req));
    res.json({ policy: policyOut(row) });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const row = await service.updatePolicy(req.params.id, getProjectId(req), req.body);
    res.json({ policy: policyOut(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await service.deletePolicy(req.params.id, getProjectId(req));
    res.json(r);
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

module.exports = router;
