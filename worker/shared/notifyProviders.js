'use strict';

/**
 * Notify channel adapters (W9a). Future home: notify_manager; today delegates to legacy managers + outboundSend.
 * CI uses MockProvider — never calls Twilio/Slack/SMTP live APIs.
 */

const outbound = require('./outboundSend');

const CHANNELS = ['email', 'sms', 'slack', 'push'];

function assertShape(channel, shape) {
  const missing = [];
  for (const [k, pred] of Object.entries(shape)) {
    try {
      if (!pred()) missing.push(k);
    } catch {
      missing.push(k);
    }
  }
  if (missing.length) {
    const e = new Error(`Invalid ${channel} notify shape: missing ${missing.join(', ')}`);
    e.status = 400;
    throw e;
  }
}

function normalizeEmailRequest(payload = {}) {
  const to = payload.to || payload.to_address || payload.recipient;
  const subject = payload.subject || payload.title || '';
  const body = payload.body || payload.text || '';
  assertShape('email', {
    to: () => Boolean(to && String(to).includes('@')),
    subject: () => subject !== undefined,
    body: () => body !== undefined,
  });
  return { channel: 'email', to: String(to), subject: String(subject), body: String(body) };
}

function normalizeSmsRequest(payload = {}) {
  const to = payload.to || payload.to_number || payload.recipient;
  const body = payload.body || payload.text || '';
  assertShape('sms', {
    to: () => Boolean(to && /^\+?[0-9]{7,}$/.test(String(to).replace(/[\s()-]/g, ''))),
    body: () => Boolean(String(body).length > 0),
  });
  return { channel: 'sms', to: String(to), body: String(body) };
}

function normalizeSlackRequest(payload = {}) {
  const text = payload.text || payload.body || payload.title || '';
  assertShape('slack', {
    text: () => Boolean(String(text).length > 0),
  });
  return {
    channel: 'slack',
    text: String(text),
    slack_channel: payload.channel || payload.slack_channel || null,
  };
}

const NORMALIZERS = {
  email: normalizeEmailRequest,
  sms: normalizeSmsRequest,
  slack: normalizeSlackRequest,
};

class EmailProvider {
  describe() {
    return { channel: 'email', transport: 'smtp|ses', live: 'secrets_manager SMTP_*' };
  }

  normalize(payload) {
    return normalizeEmailRequest(payload);
  }

  async send(req) {
    return outbound.sendEmail({ to: req.to, subject: req.subject, body: req.body, text: req.body });
  }
}

class SmsProvider {
  describe() {
    return {
      channel: 'sms',
      transport: 'twilio',
      live: 'TWILIO_* via secrets_manager',
      note: 'MockProvider used in CI — no paid API calls',
    };
  }

  normalize(payload) {
    return normalizeSmsRequest(payload);
  }

  async send(req) {
    return outbound.sendSms({ to: req.to, body: req.body });
  }
}

class SlackProvider {
  describe() {
    return { channel: 'slack', transport: 'webhook|chat.postMessage' };
  }

  normalize(payload) {
    return normalizeSlackRequest(payload);
  }

  async send(req) {
    return outbound.sendSlack({ text: req.text, channel: req.slack_channel || undefined });
  }
}

class MockProvider {
  constructor() {
    this.calls = [];
  }

  describe() {
    return { channel: 'mock', captures: true };
  }

  normalize(channel, payload) {
    const fn = NORMALIZERS[channel];
    if (!fn) {
      const e = new Error(`MockProvider: unknown channel ${channel}`);
      e.status = 400;
      throw e;
    }
    return fn(payload);
  }

  async send(channel, req) {
    const record = { channel, request: req, at: new Date().toISOString() };
    this.calls.push(record);
    return { sent: false, reason: 'mock', mock: true, request: req };
  }
}

function legacyManagerPayload(channel, projectId, normalized, extras = {}) {
  const pid = projectId || extras.project_id;
  const name = extras.name || `notify-${Date.now()}`;
  if (channel === 'email') {
    return {
      manager: 'email_manager',
      path: '/api/v1/messages',
      body: {
        project_id: pid,
        name,
        to_address: normalized.to,
        subject: normalized.subject,
        body: normalized.body,
        status: 'queued',
      },
    };
  }
  if (channel === 'sms') {
    return {
      manager: 'sms_manager',
      path: '/api/v1/messages',
      body: {
        project_id: pid,
        name,
        to: normalized.to,
        body: normalized.body,
        status: 'queued',
      },
    };
  }
  if (channel === 'slack') {
    return {
      manager: 'slack_manager',
      path: '/api/v1/messages',
      body: {
        project_id: pid,
        name,
        text: normalized.text,
        body: normalized.text,
        channel: normalized.slack_channel,
        status: 'queued',
      },
    };
  }
  return null;
}

function createChannelProvider(channel) {
  const c = String(channel || '').toLowerCase();
  if (c === 'email') return new EmailProvider();
  if (c === 'sms') return new SmsProvider();
  if (c === 'slack') return new SlackProvider();
  const e = new Error(`Unknown notify channel: ${channel}`);
  e.status = 400;
  throw e;
}

module.exports = {
  CHANNELS,
  EmailProvider,
  SmsProvider,
  SlackProvider,
  MockProvider,
  normalizeEmailRequest,
  normalizeSmsRequest,
  normalizeSlackRequest,
  legacyManagerPayload,
  createChannelProvider,
};
