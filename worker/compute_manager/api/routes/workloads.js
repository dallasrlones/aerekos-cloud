'use strict';

const express = require('express');
const { DesiredStateService } = require('../services/DesiredStateService');

const router = express.Router();
const desired = new DesiredStateService();

function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

router.put('/:id/workload', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    const workload = await desired.setDesired(req.params.id, pid, req.body || {});
    const reconcile = await desired.reconcileTask(req.params.id, pid);
    res.json({ workload, reconcile });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.get('/:id/workload', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    res.json(await desired.reconcileTask(req.params.id, pid));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/:id/reconcile', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    res.json({ reconcile: await desired.reconcileTask(req.params.id, pid) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/:id/rolling-replace', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    res.json(await desired.rollingReplace(req.params.id, pid, req.body || {}, req.body || {}));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

router.post('/reconcile-loop', async (req, res, next) => {
  try {
    const pid = getProjectId(req);
    res.json(await desired.runReconcileLoop(pid, {
      passes: req.body?.passes,
      intervalMs: req.body?.interval_ms,
    }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = router;
