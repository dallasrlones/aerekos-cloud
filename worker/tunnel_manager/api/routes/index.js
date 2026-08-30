const express = require('express');
const tunnels = require('./tunnels');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'tunnel_manager',
    title: 'Tunnel Manager (Cloudflare)',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message: 'Cloudflare Tunnel (cloudflared) lifecycle; tunnel tokens returned only on create'
  });
});

router.use('/', tunnels);

module.exports = router;
