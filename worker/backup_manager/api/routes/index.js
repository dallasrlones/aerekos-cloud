const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { projectId } = require('../../../shared/crudCore');
const { ItemService } = require('../services/ItemService');
const { JobService } = require('../services/JobService');

const service = new ItemService();
const jobs = new JobService();
const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'backup_manager',
    title: 'Backup vaults',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'AWS Backup',
    message: 'Backup vaults and snapshot jobs'
  });
});

router.use(knockoutTry(process.env.SERVICE_NAME || 'backup_manager'));
router.use('/vaults', crudRouter(service));

router.post('/jobs', async (req, res, next) => {
  try {
    const job = await jobs.create({ ...req.body, project_id: projectId(req) || req.body?.project_id });
    res.status(201).json({ job });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/jobs', async (req, res, next) => {
  try {
    res.json({ jobs: await jobs.list(projectId(req)) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await jobs.get(req.params.id, projectId(req), { signed: true });
    res.json({ job });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/jobs/:id/restore', async (req, res, next) => {
  try {
    const result = await jobs.restore(req.params.id, projectId(req) || req.body?.project_id, req.body || {});
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = { router, service, jobs };
