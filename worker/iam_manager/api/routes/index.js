const express = require('express');
const policies = require('./policies');
const roles = require('./roles');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'iam_manager',
    title: 'IAM Manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    message:
      'Project-scoped roles and JSON policies; attach policies to roles. Complements conductor auth (enforcement in conductor TBD).'
  });
});

router.use('/policies', policies);
router.use('/roles', roles);
router.use('/evaluate', require('./evaluate'));
module.exports = router;
