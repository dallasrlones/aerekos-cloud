const express = require('express');
const { RegistryEntryService } = require('../services/RegistryEntryService');

const router = express.Router();
const svc = new RegistryEntryService();

function qProject(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function handle(res, next, e) {
  if (e.status) {
    return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  }
  next(e);
}

router.post('/', async (req, res, next) => {
  try {
    const created = await svc.create({ ...req.body, project_id: req.body.project_id || qProject(req) });
    res.status(201).json({ registry: created });
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json({ registries: await svc.list(qProject(req)) });
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ registry: await svc.get(req.params.id, qProject(req)) });
  } catch (e) {
    handle(res, next, e);
  }
});

const updateHandler = async (req, res, next) => {
  try {
    res.json({ registry: await svc.update(req.params.id, qProject(req), req.body || {}) });
  } catch (e) {
    handle(res, next, e);
  }
};
router.patch('/:id', updateHandler);
router.put('/:id', updateHandler);

router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await svc.del(req.params.id, qProject(req)));
  } catch (e) {
    handle(res, next, e);
  }
});

module.exports = router;
