'use strict';

const express = require('express');
const { CheckRun } = require('../models');

const r = express.Router();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.post('/', async (req, res, next) => {
  try {
    const project_id = q(req);
    if (!project_id || !req.body.repo_id || !req.body.name) {
      return res.status(400).json({ error: { message: 'project_id, repo_id, name required' } });
    }
    const row = await CheckRun.create({
      project_id,
      repo_id: req.body.repo_id,
      sha: req.body.sha || '',
      name: req.body.name,
      status: req.body.status || 'pending',
      note: req.body.note || '',
    });
    res.status(201).json({ check: row });
  } catch (e) { next(e); }
});

r.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (q(req)) where.project_id = q(req);
    if (req.query.repo_id) where.repo_id = req.query.repo_id;
    if (req.query.sha) where.sha = req.query.sha;
    const items = await CheckRun.findAll(Object.keys(where).length ? { where } : {});
    res.json({ checks: items });
  } catch (e) { next(e); }
});

module.exports = r;
