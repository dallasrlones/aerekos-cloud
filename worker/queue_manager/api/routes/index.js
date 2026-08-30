const express = require('express');
const router = express.Router();
const queues = require('./queues');

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'queue_manager',
    title: 'Queue Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    description: 'SQS-like project-scoped message queues (SQLite + aerekos-record)'
  });
});

router.use('/queues', queues);

module.exports = router;
