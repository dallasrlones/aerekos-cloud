'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const JobService = require('../services/JobService');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const jobs = await JobService.list({
      project_id: req.query.project_id,
      limit: req.query.limit,
    });
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const job = await JobService.create(req.body || {});
    res.status(201).json({ job });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const job = await JobService.get(req.params.id);
    if (!job) return res.status(404).json({ error: { message: 'job not found' } });
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await JobService.del(req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
