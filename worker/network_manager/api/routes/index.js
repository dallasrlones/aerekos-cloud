const express = require('express');
const networks = require('./networks');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'network_manager',
    title: 'Network Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message:
      'Per-project Docker bridge networks: POST/GET/DELETE /networks. Set SKIP_DOCKER=1 in tests.'
  });
});

router.use('/networks', networks);

const { HeadscaleService } = require('../services/HeadscaleService');
const { ProjectNetworkService } = require('../services/ProjectNetworkService');
const hs = new HeadscaleService();
const nets = new ProjectNetworkService();

router.get('/mesh', async (req, res, next) => {
  try {
    res.json(await hs.meshStatus());
  } catch (e) { next(e); }
});

router.post('/mesh/preauth', async (req, res, next) => {
  try {
    const out = await hs.mintPreauth(req.body || {});
    res.status(201).json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/mesh/preauth/:id/revoke', async (req, res, next) => {
  try {
    res.json(await hs.revoke(req.params.id, { force: req.body?.force === true }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/mesh/revoke-hostname', async (req, res, next) => {
  try {
    res.json(await hs.revokeByHostname(req.body?.hostname));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/networks/ensure-default', async (req, res, next) => {
  try {
    const pid = req.query.project_id || req.body?.project_id;
    const row = await nets.ensureDefault(pid);
    res.json({ network: row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = router;
