'use strict';

const express = require('express');
const { Artifact } = require('../models');

const router = express.Router();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

router.get('/', async (req, res, next) => {
  try {
    const pid = q(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    const where = { project_id: pid };
    if (req.query.kind) where.kind = req.query.kind;
    res.json({ items: await Artifact.findAll({ where }) });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const pid = q(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    const kind = String(req.body?.kind || 'docker').toLowerCase();
    if (!['docker', 'npm', 'pypi'].includes(kind)) {
      return res.status(400).json({ error: { message: 'kind must be docker, npm, or pypi' } });
    }
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: { message: 'name required' } });
    const item = await Artifact.create({
      project_id: pid,
      name,
      kind,
      version: String(req.body?.version || 'latest'),
      uri: req.body?.uri || '',
    });
    res.status(201).json({ item });
  } catch (e) { next(e); }
});

module.exports = router;
