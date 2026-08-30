const express = require('express');
const logs = require('./logs');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'logs_manager',
    title: 'Logs Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message: 'Project-scoped log ingest and query (append-only); optional JSON context per line'
  });
});

router.use('/', logs);

module.exports = router;
