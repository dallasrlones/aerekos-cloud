const express = require('express');
const resR = require('./apps');
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'app_manager',
    title: 'App Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Amplify / App Runner',
    message: 'App project metadata + FE scaffold for Icarus IDE; deploy via compute/cicd/tunnel.',
  });
});
router.use('/apps', resR);
module.exports = router;
