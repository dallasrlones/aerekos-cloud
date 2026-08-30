const express = require('express');
const { RegistryConfigService } = require('../services/RegistryConfigService');

const router = express.Router();
const svc = new RegistryConfigService();

router.get('/config', (req, res) => {
  res.json({ registry: svc.getPublicConfig() });
});

module.exports = router;
