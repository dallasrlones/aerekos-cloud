const express = require('express');
const resR = require('./series');
const alarmR = require('./alarms');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'metrics_manager', title: 'metrics_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "Time-series samples and alarm rules that fire into event_manager." }); });
router.use('/series', resR);
router.use('/alarms', alarmR);
module.exports = router;
