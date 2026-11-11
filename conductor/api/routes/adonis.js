'use strict';

const express = require('express');
const authenticate = require('../middleware/auth');
const { requireProjectMember } = require('../middleware/requireProjectMember');
const { AdonisWorkspaceService } = require('../services/AdonisWorkspaceService');

const router = express.Router();
const svc = new AdonisWorkspaceService();

function bearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return '';
}

function handle(res, next, e) {
  if (e.status) {
    return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  }
  return next(e);
}

router.post('/workspaces', authenticate, requireProjectMember, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id || req.headers['x-project-id'];
    const workspace = await svc.ensure({
      projectId,
      repoId: req.body?.repo_id,
      ref: req.body?.ref,
      token: bearer(req),
    });
    res.status(201).json({ workspace });
  } catch (e) {
    handle(res, next, e);
  }
});

router.delete('/workspaces', authenticate, requireProjectMember, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id || req.query.project_id || req.headers['x-project-id'];
    const result = await svc.stop({
      projectId,
      taskId: req.body?.task_id || req.query.task_id,
      repoId: req.body?.repo_id || req.query.repo_id,
      token: bearer(req),
    });
    res.json(result);
  } catch (e) {
    handle(res, next, e);
  }
});

router.post('/deploy', authenticate, requireProjectMember, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id || req.headers['x-project-id'];
    const result = await svc.deploy({
      projectId,
      repoId: req.body?.repo_id,
      repoName: req.body?.repo_name,
      ref: req.body?.ref,
      token: bearer(req),
    });
    res.json(result);
  } catch (e) {
    handle(res, next, e);
  }
});

module.exports = router;
