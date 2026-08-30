'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const OpsTimelineService = require('../services/OpsTimelineService');

router.get('/timeline', authenticate, async (req, res, next) => {
  try {
    res.json(await OpsTimelineService.timeline(req.query.project_id || null));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
