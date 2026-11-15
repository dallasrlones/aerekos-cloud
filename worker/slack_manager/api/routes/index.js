const express = require('express');
const resR = require('./messages');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'slack_manager', title: 'slack_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: 'Slack post queue; send when Slack secrets exist, otherwise queue-only.' }); });
router.use('/messages', resR);
module.exports = router;
