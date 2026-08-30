'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const AuditService = require('../services/AuditService');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const items = await AuditService.list({
      limit,
      offset,
      action: req.query.action,
      project_id: req.query.project_id,
    });
    res.json({ items, limit, offset });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
