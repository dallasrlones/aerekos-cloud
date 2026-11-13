'use strict';

const express = require('express');
const { DeploymentController } = require('../services/DeploymentController');

const router = express.Router();
const ctrl = new DeploymentController();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

/** PUT /deployments/:id — apply declarative Deployment */
router.put('/:id', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    res.json(await ctrl.apply(req.params.id, pid, req.body || {}));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    const row = await ctrl.getById(req.params.id, pid);
    const { deploymentFromTaskRow, parseJson } = require('../services/deploymentSpec');
    const snap = parseJson(row.reconcile_snapshot, {});
    res.json({
      deployment: deploymentFromTaskRow(row),
      status: snap.status || null,
      revisions: ctrl.listRevisions(pid, req.params.id).map((d) => d.metadata?.revision),
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/:id/reconcile', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    res.json(await ctrl.reconcile(req.params.id, pid, {
      forceFailReady: Boolean(req.body?.force_fail_ready),
    }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/:id/pause', async (req, res, next) => {
  try {
    res.json(await ctrl.pause(req.params.id, getProjectId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/:id/resume', async (req, res, next) => {
  try {
    res.json(await ctrl.resume(req.params.id, getProjectId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/:id/rollback', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    res.json(await ctrl.rollback(req.params.id, pid, req.body?.revision));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/:id/revisions', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    await ctrl.getById(req.params.id, pid);
    res.json({ revisions: ctrl.listRevisions(pid, req.params.id) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/reconcile-project', async (req, res, next) => {
  try {
    res.json({ results: await ctrl.reconcileProject(getProjectId(req)) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = router;
