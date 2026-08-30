const express = require('express');
const resR = require('./findings');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'security_manager', title: 'security_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "Security findings and posture notes; integrate scanners later." }); });
router.use('/findings', resR);
module.exports = router;
