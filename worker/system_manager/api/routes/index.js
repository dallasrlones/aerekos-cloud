const express = require('express');
const resR = require('./tasks');
const hostsR = require('./hosts');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'system_manager', title: 'system_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "Host OS/Docker check+update (always-on per device) plus maintenance task specs." }); });
router.use('/hosts', hostsR);
router.use('/tasks', resR);
module.exports = router;
