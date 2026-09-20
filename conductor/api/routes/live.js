'use strict';

const express = require('express');
const JWTService = require('../services/JWTService');
const authenticateService = require('../middleware/serviceAuth');
const WorkerSocketService = require('../services/WorkerSocketService');
const { isLiveRoom, isLiveEvent } = require('../services/LiveRoom');

const router = express.Router();

const { workerTokenOk } = require('../middleware/workerTokenAuth');

function authenticateLive(req, res, next) {
  const raw = req.headers.authorization || '';
  if (!raw.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'token required', status: 401 } });
  }
  const token = raw.slice(7);
  if (workerTokenOk(token)) {
    req.live = { kind: 'worker' };
    return next();
  }
  try {
    req.user = JWTService.verifyToken(token);
    req.live = { kind: 'user' };
    return next();
  } catch (_) {
    return authenticateService(req, res, next);
  }
}

router.post('/', authenticateLive, (req, res) => {
  const { room, event, data } = req.body || {};
  if (!isLiveRoom(room)) {
    return res.status(400).json({ error: { message: 'invalid room' } });
  }
  if (!isLiveEvent(event)) {
    return res.status(400).json({ error: { message: 'invalid event' } });
  }
  WorkerSocketService.broadcastToRoom(room, event, data && typeof data === 'object' ? data : {});
  return res.json({ ok: true });
});

module.exports = router;
