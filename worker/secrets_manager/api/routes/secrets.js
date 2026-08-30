const express = require('express');
const { SecretService } = require('../services/SecretService');
const { enrichSecret } = require('../services/SecretArn');

const router = express.Router();
const service = new SecretService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function toPublic(r, { includeValue, value, includeCiphertext } = {}) {
  const o = {
    id: r.id,
    project_id: r.project_id,
    environment: r.environment || 'prod',
    name: r.name,
    key_name: r.key_name,
    key_version: r.key_version,
    metadata: r.metadata || null,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
  if (includeValue) {
    o.value = value;
  }
  if (includeCiphertext && !includeValue) {
    o.ciphertext = r.ciphertext;
  }
  try {
    return enrichSecret(o);
  } catch {
    return o;
  }
}

router.post('/secrets', async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: getProjectId(req) || req.body.project_id };
    const row = await service.create(body);
    res.status(201).json({ secret: toPublic(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/secrets/values', async (req, res, next) => {
  try {
    const env = req.query.environment || req.query.env || 'prod';
    const values = await service.listPlainForEnv(getProjectId(req), env);
    res.json({ environment: env, values });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/secrets', async (req, res, next) => {
  try {
    const list = await service.list(getProjectId(req), req.query.environment || req.query.env);
    const includeCiphertext = req.query.include_ciphertext === '1' || req.query.include_ciphertext === 'true';
    res.json({ secrets: list.map((r) => toPublic(r, { includeCiphertext })) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.get('/secrets/:id', async (req, res, next) => {
  try {
    const row = await service.getById(req.params.id, getProjectId(req));
    const reveal = req.query.reveal === '1' || req.query.reveal === 'true';
    if (reveal) {
      const value = await service.getPlaintext(row);
      return res.json({ secret: toPublic(row, { includeValue: true, value }) });
    }
    res.json({ secret: toPublic(row, { includeCiphertext: true }) });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

router.patch('/secrets/:id', async (req, res, next) => {
  try {
    const row = await service.update(req.params.id, getProjectId(req), req.body);
    res.json({ secret: toPublic(row) });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

router.delete('/secrets/:id', async (req, res, next) => {
  try {
    const r = await service.deleteById(req.params.id, getProjectId(req));
    res.json(r);
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ error: { message: e.message } });
    }
    next(e);
  }
});

module.exports = router;
