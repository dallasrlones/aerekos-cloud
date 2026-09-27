'use strict';

const express = require('express');
const authenticate = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/system/infra/export
 * System-tier infra-as-code file: devices (with capabilities / disk), system
 * resources (system buckets, platform services) and an index of every
 * project's infra file. Committed to the `system` project's `infra` repo at
 * system/infra.json.
 */
router.get('/infra/export', authenticate, async (req, res, next) => {
  try {
    const InfraService = require('../services/InfraService');
    res.json(await InfraService.exportSystem());
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

module.exports = router;
