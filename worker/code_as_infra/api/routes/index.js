const express = require('express');
const resR = require('./modules');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'code_as_infra', title: 'code_as_infra', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "Small IaC or config snippets." }); });
router.use('/modules', resR);
module.exports = router;
