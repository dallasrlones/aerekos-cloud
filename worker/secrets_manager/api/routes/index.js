const express = require('express');
const secrets = require('./secrets');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'secrets_manager',
    title: 'Secrets Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message: 'Project-scoped secrets; envelope encryption via key_manager (MOCK_KEY_MANAGER for dev)'
  });
});

router.use('/', secrets);

module.exports = router;
