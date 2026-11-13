'use strict';

const express = require('express');
const JWTService = require('../services/JWTService');
const authenticateService = require('../middleware/serviceAuth');
const WorkerSocketService = require('../services/WorkerSocketService');
const { isLiveRoom, isLiveEvent, projectIdFromRoom } = require('../services/LiveRoom');
const { userIsProjectMember } = require('../middleware/requireProjectMember');

const router = express.Router();

const { workerTokenOk } = require('../middleware/workerTokenAuth');

async function authenticateLive(req, res, next) {
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
    try {
      req.user = JWTService.verifyToken(token);
    } catch (error) {
      if (error.message === 'Invalid token' && typeof JWTService.loadKmsSecret === 'function') {
        await JWTService.loadKmsSecret();
        req.user = JWTService.verifyToken(token);
      } else {
        throw error;
      }
    }
    req.live = { kind: 'user' };
    return next();
  } catch (_) {
    return authenticateService(req, res, next);
  }
}

router.post('/', authenticateLive, async (req, res, next) => {
  try {
    const { room, event, data } = req.body || {};
    if (!isLiveRoom(room)) {
      return res.status(400).json({ error: { message: 'invalid room' } });
    }
    if (!isLiveEvent(event)) {
      return res.status(400).json({ error: { message: 'invalid event' } });
    }
    const pid = projectIdFromRoom(room);
    if (pid && req.live?.kind === 'user' && req.user?.role !== 'admin') {
      const uid = req.user?.id || req.user?.userId || req.user?.sub || req.userId;
      const allowed = await userIsProjectMember(uid, pid);
      if (!allowed) {
        return res.status(403).json({
          error: { message: 'not a member of this project', code: 'PROJECT_MEMBER_REQUIRED', status: 403 },
        });
      }
    }
    WorkerSocketService.broadcastToRoom(room, event, data && typeof data === 'object' ? data : {});
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
