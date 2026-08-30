const express = require('express');
const resR = require('./targets');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'balancer_manager', title: 'balancer_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "Per-project load-balancer target hints; no cloud LB API yet." }); });
router.use('/targets', resR);
module.exports = router;
