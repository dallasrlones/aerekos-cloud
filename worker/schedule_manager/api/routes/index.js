const express = require('express');
const router = express.Router();
const schedules = require('./schedules');

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'schedule_manager',
    title: 'Schedule Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    description: 'Cron schedules → webhook or queue_manager'
  });
});

router.use('/schedules', schedules);

module.exports = router;
