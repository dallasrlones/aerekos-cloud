const express = require('express');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'db_manager',
    title: 'Database Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message:
      'Managed DB control plane (engines + sqlite3/lancedb); encrypts secrets via key_manager (MOCK_KEY_MANAGER for dev/tests only)',
  });
});

module.exports = router;
