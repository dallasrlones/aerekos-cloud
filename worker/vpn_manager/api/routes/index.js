const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const hs = require('../services/HeadscaleClient');
const service = new ItemService();
const router = express.Router();

function wrap(fn) {
  return async (req, res, next) => {
    try { await fn(req, res); } catch (e) {
      if (e.body) return res.status(e.status || 503).json(e.body);
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  };
}

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'vpn_manager',
    title: 'VPN peers',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Client VPN',
    message: 'VPN peers (Headscale when configured)'
  });
});

router.get('/status', (req, res) => {
  res.json(hs.status());
});

router.post('/preauth-keys', wrap(async (req, res) => {
  const st = hs.status();
  if (!st.hooked_up) return res.status(503).json(st);
  res.status(201).json(await hs.createPreauthKey(req.body || {}));
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'vpn_manager'));
router.use('/peers', crudRouter(service));
module.exports = { router, service };
