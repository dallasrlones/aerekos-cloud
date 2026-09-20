'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { authenticateWorkerOrUser } = require('../middleware/workerTokenAuth');
const FleetHealthService = require('../services/FleetHealthService');

router.get('/health', authenticate, async (req, res, next) => {
  try {
    const projectId = req.query.project_id || null;
    const snap = await FleetHealthService.snapshot(projectId);
    res.json(snap);
  } catch (err) {
    next(err);
  }
});

router.get('/capacity', authenticateWorkerOrUser, async (req, res, next) => {
  try {
    const CapacityService = require('../services/CapacityService');
    const hosts = await CapacityService.hosts();
    res.json({ hosts });
  } catch (err) {
    next(err);
  }
});

router.post('/capacity/can-fit', authenticateWorkerOrUser, async (req, res, next) => {
  try {
    const CapacityService = require('../services/CapacityService');
    const workerId = req.body.worker_id || req.body.hostname;
    const result = await CapacityService.canFitOn(workerId, {
      requestGb: req.body.request_gb,
      reserveGb: req.body.reserve_gb,
      already: req.body.already,
    });
    const status = result.fit.ok ? 200 : 409;
    res.status(status).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

router.post('/capacity/enqueue', authenticate, async (req, res, next) => {
  try {
    const CapacityService = require('../services/CapacityService');
    const projectId = req.body.project_id || req.query.project_id;
    if (!projectId) return res.status(400).json({ error: { message: 'project_id required' } });
    res.json(await CapacityService.enqueue(projectId, req.body || {}));
  } catch (err) {
    next(err);
  }
});

router.get('/updates', authenticate, async (req, res, next) => {
  try {
    const UpdateService = require('../services/UpdateService');
    const WorkerRepository = require('../repos/WorkerRepository');
    const workers = await WorkerRepository.findAll();
    const devices = (workers || []).map((w) => {
      const current = w.version || w.current_version || 'unknown';
      const decision = UpdateService.peek(w.hostname, current);
      return {
        id: w.id,
        hostname: w.hostname,
        display_name: w.display_name || '',
        current,
        desired: decision.version,
        update: decision.update,
        reason: decision.reason,
        paused: UpdateService.isPaused(w.hostname),
        window: UpdateService.window,
      };
    });
    res.json({ devices, window: UpdateService.window });
  } catch (err) {
    next(err);
  }
});

router.post('/updates/pause', authenticate, async (req, res, next) => {
  try {
    const UpdateService = require('../services/UpdateService');
    const JobService = require('../services/JobService');
    UpdateService.pause(req.body?.hostname);
    const job = await JobService.create({
      project_id: req.body?.project_id || '',
      kind: 'updates-pause',
      summary: `pause ${req.body?.hostname || 'fleet'}`,
      status: 'succeeded',
    });
    res.json({ paused: true, hostname: req.body?.hostname || '*', job });
  } catch (err) {
    next(err);
  }
});

router.post('/updates/pin', authenticate, async (req, res, next) => {
  try {
    const UpdateService = require('../services/UpdateService');
    res.json(UpdateService.pin(req.body?.hostname, req.body?.version));
  } catch (err) {
    next(err);
  }
});

router.post('/updates/unpin', authenticate, async (req, res, next) => {
  try {
    const UpdateService = require('../services/UpdateService');
    res.json(UpdateService.unpin(req.body?.hostname));
  } catch (err) {
    next(err);
  }
});

router.post('/updates/run-now', authenticate, async (req, res, next) => {
  try {
    const UpdateService = require('../services/UpdateService');
    const JobService = require('../services/JobService');
    let nudged = [];
    if (req.body?.hostname) {
      UpdateService.requestUpdate(req.body.hostname);
      nudged = [req.body.hostname];
    } else {
      const r = await UpdateService.requestUpdateAll();
      nudged = r.hostnames || [];
    }
    const job = await JobService.create({
      project_id: req.body?.project_id || '',
      kind: 'updates-run-now',
      summary: `run-now ${nudged.join(',') || 'fleet'}`,
      status: 'succeeded',
    });
    res.json({ queued: true, hostnames: nudged, job });
  } catch (err) {
    next(err);
  }
});

router.post('/test-alert', authenticate, async (req, res, next) => {
  try {
    const WorkerSocketService = require('../services/WorkerSocketService');
    const payload = {
      service: req.body?.service || 'test_manager',
      workerId: req.body?.workerId || 'sandbox',
      hostname: req.body?.hostname || 'sandbox',
      projectId: req.body?.project_id || null,
      timestamp: new Date().toISOString(),
    };
    const event = req.body?.event || 'service:unhealthy';
    WorkerSocketService.io?.of('/frontend')?.to('frontend')?.emit(event, payload);
    res.json({ ok: true, event, payload });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
