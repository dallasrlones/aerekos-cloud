const express = require('express');
const webhooks = require('./webhooks');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'webhook_manager',
    title: 'Webhook Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message:
      'Project-scoped outbound webhooks. Set SKIP_OUTBOUND=1 to record deliveries without HTTP. No inbound receiver here.'
  });
});

router.use('/webhooks', webhooks);

module.exports = router;
