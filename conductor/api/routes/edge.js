'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const EdgeService = require('../services/EdgeService');

router.get('/cloudflare/probe', authenticate, async (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id query parameter is required', status: 400 },
      });
    }
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: { message: 'Authorization required', status: 401 } });
    }
    const probe = await EdgeService.probeCloudflare(projectId, token);
    res.json({ probe });
  } catch (e) {
    next(e);
  }
});

router.post('/bind', authenticate, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id || req.query.project_id;
    if (!projectId) return res.status(400).json({ error: { message: 'project_id required', status: 400 } });
    const result = await EdgeService.bind(projectId, req.headers.authorization, req.body || {});
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, status: e.status } });
    next(e);
  }
});

router.post('/unbind', authenticate, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id || req.query.project_id;
    const result = await EdgeService.unbind(projectId, req.headers.authorization, req.body?.id || req.body?.binding_id);
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, status: e.status } });
    next(e);
  }
});

router.post('/import-task-hostnames', authenticate, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id || req.query.project_id;
    if (!projectId) return res.status(400).json({ error: { message: 'project_id required', status: 400 } });
    const result = await EdgeService.importTaskHostnames(projectId, req.headers.authorization, req.body || {});
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, status: e.status } });
    next(e);
  }
});

router.post('/attachments', authenticate, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id || req.query.project_id;
    if (!projectId) return res.status(400).json({ error: { message: 'project_id required', status: 400 } });
    const result = await EdgeService.attachHostname(projectId, req.headers.authorization, req.body || {});
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, status: e.status } });
    next(e);
  }
});

router.post('/attachments/remove', authenticate, async (req, res, next) => {
  try {
    const projectId = req.body?.project_id || req.query.project_id;
    if (!projectId) return res.status(400).json({ error: { message: 'project_id required', status: 400 } });
    const result = await EdgeService.detachHostname(projectId, req.headers.authorization, req.body || {});
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, status: e.status } });
    next(e);
  }
});

router.get('/tunnels/named', authenticate, async (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    if (!projectId) return res.status(400).json({ error: { message: 'project_id required', status: 400 } });
    const tunnels = await EdgeService.nameImportedTunnels(projectId, req.headers.authorization);
    res.json({ tunnels });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
