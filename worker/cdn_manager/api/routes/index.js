const express = require('express');
const resR = require('./rules');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'cdn_manager', title: 'cdn_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "CDN-style routing rules; wire to a real edge later." }); });
router.use('/rules', resR);
router.post('/purge', async (req, res, next) => {
  try {
    const { purge } = require('../services/CloudflareEdge');
    res.json(await purge(req.body || {}));
  } catch (e) { next(e); }
});
router.post('/cache-rules', async (req, res, next) => {
  try {
    const { putCacheRule } = require('../services/CloudflareEdge');
    res.json(await putCacheRule(req.body || {}));
  } catch (e) { next(e); }
});
router.post('/waf', async (req, res, next) => {
  try {
    const { putWafNote } = require('../services/CloudflareEdge');
    res.json(await putWafNote(req.body || {}));
  } catch (e) { next(e); }
});
module.exports = router;
