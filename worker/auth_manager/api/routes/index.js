const express = require('express');
const resR = require('./providers');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'auth_manager', title: 'auth_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "OIDC/OAuth provider *metadata*; use secrets_manager for real client_secret." }); });
router.use('/providers', resR);
router.use('/credentials', require('./credentials'));
router.use('/auth', require('./auth'));
module.exports = router;
