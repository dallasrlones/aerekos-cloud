'use strict';

const express = require('express');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'storage_manager',
    title: 'Storage Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message:
      'S3-compatible object storage; envelope encryption via key_manager (MOCK_KEY_MANAGER for local/tests only; refused when NODE_ENV=production)',
  });
});

module.exports = router;
