const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const service = new ItemService();
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'audit_manager',
    title: 'Audit events',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'CloudTrail',
    message: 'Audit events'
  });
});
router.post('/ingest', async (req, res) => {
  const pid = req.body?.project_id;
  const item = pid ? await service.create({
    project_id: pid,
    name: req.body?.name || `evt-${Date.now().toString(36)}`,
    actor: req.body?.actor || '',
    action: req.body?.action || '',
    detail: typeof req.body?.detail === 'string' ? req.body.detail : JSON.stringify(req.body?.detail || {}),
  }) : { skipped: true };
  res.status(201).json({ item });
});
router.use(knockoutTry(process.env.SERVICE_NAME || 'audit_manager'));
router.use('/events', crudRouter(service));
module.exports = { router, service };
