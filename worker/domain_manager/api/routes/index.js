const express = require('express');
const dns = require('./dns');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'domain_manager',
    title: 'Domain Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message: 'Cloudflare DNS record sync (zones + project scope)'
  });
});

router.use('/dns', dns);
router.use('/dns', require('./hostnames'));

module.exports = router;
