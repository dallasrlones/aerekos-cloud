'use strict';

const express = require('express');
const { HostService } = require('../services/HostService');

const r = express.Router();
const s = new HostService();

function sendProxy(res, result) {
  const status = result?.status || 502;
  if (result?.data != null) {
    return res.status(status).json(result.data);
  }
  return res.status(status).json({ error: { message: 'Conductor host proxy failed', status } });
}

r.get('/:workerId/check', async (req, res, next) => {
  try {
    sendProxy(res, await s.check(req.params.workerId, req));
  } catch (e) {
    next(e);
  }
});

r.post('/:workerId/check', async (req, res, next) => {
  try {
    sendProxy(res, await s.check(req.params.workerId, req));
  } catch (e) {
    next(e);
  }
});

r.post('/:workerId/update', async (req, res, next) => {
  try {
    sendProxy(res, await s.update(req.params.workerId, req.body?.target, req));
  } catch (e) {
    next(e);
  }
});

module.exports = r;
