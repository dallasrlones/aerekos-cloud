'use strict';

const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { MessageService } = require('../services/MessageService');
const { ChannelService } = require('../services/ChannelService');
const { notify } = require('../../../shared/notifyFacade');
const {
  CHANNELS,
  createChannelProvider,
  MockProvider,
} = require('../../../shared/notifyProviders');

const messageService = new MessageService();
const channelService = new ChannelService();
const router = express.Router();

function pid(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function payloadFromMessage(item) {
  const ch = String(item.channel || 'email').toLowerCase();
  if (ch === 'sms') {
    return { to: item.to_address, body: item.body || '' };
  }
  if (ch === 'slack') {
    return { text: item.body || item.subject || '', channel: item.to_address || undefined };
  }
  return {
    to: item.to_address,
    subject: item.subject || '',
    body: item.body || '',
  };
}

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'notify_manager',
    title: 'Unified notify (email/sms/slack/push facade)',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'SNS / SES / Chatbot merge',
    mock: process.env.NOTIFY_USE_MOCK === '1' || process.env.CI === 'true',
    message:
      'Unified notify facade; MockProvider by default in non-prod. Legacy email/sms/slack stay registered until Phase 2.',
  });
});

router.get('/providers', (req, res) => {
  const mock = process.env.NOTIFY_USE_MOCK === '1' || process.env.CI === 'true';
  const providers = CHANNELS.map((ch) => {
    try {
      if (mock || ch === 'push') {
        const desc = new MockProvider().describe();
        return {
          ...desc,
          channel: ch,
          transport: 'mock',
          note: ch === 'push' ? 'push adapter parked; mock only' : undefined,
        };
      }
      return createChannelProvider(ch).describe();
    } catch (e) {
      return { channel: ch, error: e.message };
    }
  });
  res.json({ providers, mock });
});

router.post('/test', async (req, res, next) => {
  try {
    const projectId = pid(req);
    if (!projectId) {
      return res.status(400).json({ error: { message: 'project_id required' } });
    }
    const channel = String(req.body?.channel || 'email').toLowerCase();
    const payload = req.body?.payload || req.body || {};
    const useMock =
      req.body?.useMock === true ||
      process.env.NOTIFY_USE_MOCK === '1' ||
      process.env.CI === 'true';
    const result = await notify({
      projectId,
      channel,
      payload,
      send: true,
      useMock,
      delegate: undefined,
    });
    res.json({ ok: true, result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/messages/:id/send', async (req, res, next) => {
  try {
    const projectId = pid(req);
    const item = await messageService.get(req.params.id, projectId);
    const channel = String(item.channel || 'email').toLowerCase();
    const useMock =
      process.env.NOTIFY_USE_MOCK === '1' ||
      process.env.CI === 'true' ||
      process.env.SKIP_OUTBOUND === '1';
    const result = await notify({
      projectId,
      channel,
      payload: payloadFromMessage(item),
      send: true,
      useMock,
    });
    const status = result.sendResult?.sent ? 'sent' : 'queued';
    const updated = await messageService.update(item.id, projectId, { status });
    res.json({
      item: updated,
      skipped: !result.sendResult?.sent,
      reason: result.sendResult?.reason || (result.sendResult?.sent ? 'sent' : 'queue_only'),
      mock: Boolean(result.mock),
      sendResult: result.sendResult,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.use(knockoutTry(process.env.SERVICE_NAME || 'notify_manager'));
router.use('/messages', crudRouter(messageService));
router.use('/channels', crudRouter(channelService));

module.exports = { router, messageService, channelService };
