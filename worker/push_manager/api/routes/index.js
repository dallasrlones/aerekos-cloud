const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const service = new ItemService();
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'push_manager',
    title: 'Push subscriptions',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'SNS mobile',
    message: 'Push subscriptions'
  });
});
router.use(knockoutTry(process.env.SERVICE_NAME || 'push_manager'));
router.use('/subscriptions', crudRouter(service));
router.post('/send', async (req, res, next) => {
  try {
    const { sendPush } = require('../../../shared/outboundSend');
    const result = await sendPush({
      to: req.body?.to || req.body?.token,
      title: req.body?.title,
      body: req.body?.body,
    });
    res.json({ skipped: !result.sent, reason: result.reason || (result.sent ? 'sent' : 'queue_only'), note: result.note });
  } catch (e) { next(e); }
});
module.exports = { router, service };
