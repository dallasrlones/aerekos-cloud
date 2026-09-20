const express = require('express');
const resR = require('./messages');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'email_manager', title: 'email_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: 'Email queue; send when SMTP secrets exist, otherwise queue-only.' }); });
router.use('/messages', resR);
module.exports = router;
