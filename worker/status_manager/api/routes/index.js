const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const service = new ItemService();
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'status_manager',
    title: 'Status incidents',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Statuspage',
    message: 'Status incidents'
  });
});
router.get('/public', async (req, res) => {
  const pid = req.query.project_id;
  const items = pid ? await service.list(pid) : [];
  const open = items.filter((i) => i.state && i.state !== 'resolved');
  res.json({ status: open.length ? 'degraded' : 'ok', incidents: items });
});
router.use(knockoutTry(process.env.SERVICE_NAME || 'status_manager'));
router.use('/incidents', crudRouter(service));
module.exports = { router, service };
