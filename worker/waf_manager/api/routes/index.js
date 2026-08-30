const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const service = new ItemService();
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'waf_manager',
    title: 'WAF rules',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'WAF',
    message: 'WAF rules'
  });
});
router.post('/evaluate', async (req, res) => {
  const pid = req.body?.project_id || req.query.project_id;
  const rules = pid ? await service.list(pid) : [];
  const ip = req.body?.ip || '';
  const path = req.body?.path || '/';
  let action = 'allow';
  for (const r of rules) {
    if (r.cidr && ip && r.cidr === ip) action = r.action || 'block';
    if (r.path && path.startsWith(r.path) && r.action === 'block') action = 'block';
  }
  res.json({ action, matched: rules.length });
});
router.use(knockoutTry(process.env.SERVICE_NAME || 'waf_manager'));
router.use('/rules', crudRouter(service));
module.exports = { router, service };
