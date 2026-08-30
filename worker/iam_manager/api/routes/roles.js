const express = require('express');
const { IamService } = require('../services/IamService');

const router = express.Router();
const service = new IamService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function roleOut(r) {
  return {
    id: r.id,
    project_id: r.project_id,
    name: r.name,
    description: r.description || null,
    metadata: r.metadata || null,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function policyOut(p, svc) {
  return {
    id: p.id,
    project_id: p.project_id,
    name: p.name,
    effect: p.effect,
    document: svc.documentToJson(p.document),
    description: p.description || null,
    metadata: p.metadata || null,
    created_at: p.created_at,
    updated_at: p.updated_at
  };
}

router.get('/:roleId/policies', async (req, res, next) => {
  try {
    const { policies, bindings } = await service.listPoliciesForRole(
      req.params.roleId,
      getProjectId(req)
    );
    res.json({
      role_id: req.params.roleId,
      policies: policies.map((p) => policyOut(p, service)),
      binding_ids: bindings.map((b) => b.id)
    });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.post('/:roleId/policies', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const b = await service.attachPolicyToRole(
      req.params.roleId,
      req.body.policy_id,
      projectId
    );
    res.status(201).json({ binding: { id: b.id, role_id: b.role_id, policy_id: b.policy_id } });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.delete('/:roleId/policies/:policyId', async (req, res, next) => {
  try {
    const r = await service.detachPolicyFromRole(
      req.params.roleId,
      req.params.policyId,
      getProjectId(req)
    );
    res.json(r);
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
    const row = await service.createRole(body);
    res.status(201).json({ role: roleOut(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const list = await service.listRoles(getProjectId(req));
    res.json({ roles: list.map(roleOut) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await service.getRole(req.params.id, getProjectId(req));
    res.json({ role: roleOut(row) });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const row = await service.updateRole(req.params.id, getProjectId(req), req.body);
    res.json({ role: roleOut(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await service.deleteRole(req.params.id, getProjectId(req));
    res.json(r);
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

module.exports = router;
