const express = require('express');
const resR = require('./apps');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'app_manager', title: 'app_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "Application build project metadata." }); });
router.use('/apps', resR);
module.exports = router;
