const express = require('express');
const resR = require('./tools');
const { PLATFORM_TOOLS } = require('../schemas/platformTools');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'mcp_manager', title: 'mcp_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: "MCP tool registry metadata." }); });
router.get('/platform-tools', (req, res) => {
  res.json({
    items: PLATFORM_TOOLS,
    note: 'email/sms/slack/push are queued; outbound send disabled. Do not register live-send tools.',
  });
});
router.use('/tools', resR);
module.exports = router;
