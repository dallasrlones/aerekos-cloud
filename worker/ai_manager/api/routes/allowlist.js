'use strict';

const express = require('express');
const router = express.Router();

const lists = new Map();

router.get('/', (req, res) => {
  const pid = req.query.project_id || req.headers['x-project-id'] || 'default';
  res.json({ project_id: pid, models: lists.get(pid) || [] });
});

router.put('/', (req, res) => {
  const pid = req.body.project_id || req.query.project_id || req.headers['x-project-id'] || 'default';
  const models = Array.isArray(req.body.models) ? req.body.models.map(String) : [];
  lists.set(pid, models);
  res.json({ project_id: pid, models });
});

module.exports = router;
