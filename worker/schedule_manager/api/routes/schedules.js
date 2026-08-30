const express = require('express');
const { ScheduleService } = require('../services/ScheduleService');

const router = express.Router();
const service = new ScheduleService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

router.post('/', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const row = await service.create({ ...req.body, project_id: projectId || req.body.project_id });
    res.status(201).json({ schedule: row });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const list = await service.list(getProjectId(req));
    res.json({ schedules: list });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/run', async (req, res, next) => {
  try {
    const r = await service.runNow(req.params.id, getProjectId(req));
    res.json(r);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, data: e.data } });
    }
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await service.getById(req.params.id, getProjectId(req));
    res.json({ schedule: row });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const row = await service.update(req.params.id, getProjectId(req), req.body);
    res.json({ schedule: row });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await service.delete(req.params.id, getProjectId(req));
    res.json(r);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
