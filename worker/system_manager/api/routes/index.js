'use strict';

const express = require('express');
const resR = require('./tasks');
const hostsR = require('./hosts');

const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'system_manager',
    title: 'system_manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Systems Manager',
    message:
      'Maintenance task specs (SQLite) plus host OS/Docker check+update proxied to conductor /api/workers/:id/host/*.',
  });
});
router.use('/hosts', hostsR);
router.use('/tasks', resR);
module.exports = router;
