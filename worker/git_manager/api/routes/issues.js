'use strict';

const express = require('express');
const { Issue } = require('../models');

const r = express.Router();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.post('/', async (req, res, next) => {
  try {
    const project_id = q(req);
    if (!project_id) return res.status(400).json({ error: { message: 'project_id required' } });
    if (!req.body.repo_id || !req.body.title) return res.status(400).json({ error: { message: 'repo_id and title required' } });
    const row = await Issue.create({
      project_id,
      repo_id: req.body.repo_id,
      title: String(req.body.title).trim(),
      body: req.body.body || '',
      status: req.body.status || 'open',
      author: req.body.author || req.user?.username || 'console',
    });
    res.status(201).json({ issue: row });
  } catch (e) { next(e); }
});

r.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (q(req)) where.project_id = q(req);
    if (req.query.repo_id) where.repo_id = req.query.repo_id;
    if (req.query.status) where.status = req.query.status;
    const items = await Issue.findAll(Object.keys(where).length ? { where } : {});
    res.json({ issues: items });
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const rows = await Issue.findAll({ where: { id: req.params.id, project_id: q(req) } });
    if (!rows.length) return res.status(404).json({ error: { message: 'not found' } });
    res.json({ issue: rows[0] });
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const rows = await Issue.findAll({ where: { id: req.params.id, project_id: q(req) } });
    if (!rows.length) return res.status(404).json({ error: { message: 'not found' } });
    const patch = {};
    for (const k of ['title', 'body', 'status']) {
      if (req.body[k] != null) patch[k] = req.body[k];
    }
    if (Object.keys(patch).length) await Issue.update(req.params.id, patch);
    const next = await Issue.findAll({ where: { id: req.params.id } });
    res.json({ issue: next[0] });
  } catch (e) { next(e); }
});

module.exports = r;
