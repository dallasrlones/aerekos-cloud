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

/**
 * POST /api/system/infra/import
 * Create a brand-new project from an infra file: the project is created,
 * its infra repo hooked up (git mode), and the file applied to it — the
 * new project comes up with the same infra as the file.
 * Body: { name, description?, file, any_device? }.
 */
router.post('/infra/import', authenticate, async (req, res, next) => {
  try {
    const InfraService = require('../services/InfraService');
    res.json(await InfraService.importProject({
      name: req.body && req.body.name,
      description: req.body && req.body.description,
      file: req.body && req.body.file,
      anyDevice: !!(req.body && req.body.any_device),
    }, req.headers.authorization));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

module.exports = router;
