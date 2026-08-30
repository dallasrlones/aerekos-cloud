const express = require('express');
const resR = require('./messages');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'sms_manager', title: 'sms_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "SMS messages; use SKIP_SMS=1." }); });
router.use('/messages', resR);
module.exports = router;
