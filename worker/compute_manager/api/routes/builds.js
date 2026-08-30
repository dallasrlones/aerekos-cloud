'use strict';

const express = require('express');
const { BuildService } = require('../services/BuildService');

const router = express.Router();
const svc = new BuildService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

router.post('/', async (req, res, next) => {
  try {
    const out = await svc.build({ ...req.body, project_id: getProjectId(req) || req.body?.project_id });
    res.status(201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = router;
