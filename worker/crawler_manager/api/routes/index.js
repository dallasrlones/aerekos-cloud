const express = require('express');
const resR = require('./jobs');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'crawler_manager', title: 'crawler_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "Crawl jobs; run fetch with SKIP_CRAWL=1 in tests." }); });
router.use('/jobs', resR);
module.exports = router;
