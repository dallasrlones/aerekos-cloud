'use strict';

/**
 * Unified notify entry (W9a). Does not remove email_manager/sms_manager/slack_manager —
 * when `delegate` is set, enqueues via legacy manager CRUD shape before optional live send.
 */

const {
  createChannelProvider,
  legacyManagerPayload,
  MockProvider,
} = require('./notifyProviders');

/**
 * @param {{ projectId: string, channel: string, payload: object, send?: boolean, useMock?: boolean, delegate?: (spec: object) => Promise<object> }} opts
 */
async function notify({ projectId, channel, payload, send = false, useMock, delegate }) {
  const ch = String(channel || '').toLowerCase();
  const mock = useMock || process.env.NOTIFY_USE_MOCK === '1' || process.env.CI === 'true';
  const provider = mock ? new MockProvider() : createChannelProvider(ch);
  const normalized = mock ? provider.normalize(ch, payload) : provider.normalize(payload);

  const out = { channel: ch, normalized, legacy: null, sendResult: null, mock: Boolean(mock) };

  if (delegate && process.env.NOTIFY_DELEGATE_LEGACY !== '0') {
    const spec = legacyManagerPayload(ch, projectId, normalized, payload);
    if (spec) {
      out.legacy = await delegate(spec);
    }
  }

  if (send) {
    out.sendResult = mock
      ? await provider.send(ch, normalized)
      : await provider.send(normalized);
  }

  return out;
}

/**
 * Fan-out helper matching conductor AlertFanout shape without requiring ServiceManager in tests.
 */
async function notifyFanout(
  projectId,
  { title, body, channels = ['slack', 'email', 'sms'], delegate, send = false, useMock }
) {
  const text = body || '';
  const results = [];
  for (const ch of channels) {
    const payload =
      ch === 'email'
        ? { to: process.env.ALERT_EMAIL_TO || 'ops@example.test', subject: title || 'alert', body: text }
        : ch === 'sms'
          ? { to: process.env.ALERT_SMS_TO || '+15555550100', body: text }
          : { text: `[${title || 'alert'}] ${text}` };
    results.push(await notify({ projectId, channel: ch, payload, delegate, send, useMock }));
  }
  return { results };
}

module.exports = { notify, notifyFanout };
