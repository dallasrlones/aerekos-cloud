'use strict';

/**
 * Send-when-keys, queue-only otherwise.
 * SKIP_OUTBOUND / SKIP_SMTP / SKIP_SMS / SKIP_SLACK / SKIP_PUSH force queue.
 */

function skip(channel) {
  if (process.env.SKIP_OUTBOUND === '1' || process.env.SKIP_OUTBOUND === 'true') return true;
  const map = {
    email: 'SKIP_SMTP',
    sms: 'SKIP_SMS',
    slack: 'SKIP_SLACK',
    push: 'SKIP_PUSH',
  };
  const key = map[channel];
  return key && (process.env[key] === '1' || process.env[key] === 'true');
}

function env(...names) {
  for (const n of names) {
    const v = String(process.env[n] || '').trim();
    if (v) return v;
  }
  return '';
}

async function sendEmail({ to, subject, body, text }) {
  if (skip('email')) return { sent: false, reason: 'queue_only' };
  const host = env('SMTP_HOST', 'smtp_host');
  const user = env('SMTP_USER', 'smtp_user');
  const pass = env('SMTP_PASS', 'smtp_pass');
  const from = env('SMTP_FROM', 'smtp_from') || user;
  if (!host || !user || !pass) return { sent: false, reason: 'queue_only', note: 'SMTP secrets missing' };
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return { sent: false, reason: 'queue_only', note: 'nodemailer not installed' };
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(env('SMTP_PORT') || 587),
    secure: env('SMTP_SECURE') === '1',
    auth: { user, pass },
  });
  await transporter.sendMail({ from, to, subject, text: text || body || '' });
  return { sent: true };
}

async function sendSlack({ text, channel }) {
  if (skip('slack')) return { sent: false, reason: 'queue_only' };
  const webhook = env('SLACK_WEBHOOK_URL', 'slack_webhook_url');
  const token = env('SLACK_BOT_TOKEN', 'slack_bot_token');
  if (webhook) {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text || '', channel }),
    });
    if (!r.ok) throw new Error(`slack webhook ${r.status}`);
    return { sent: true };
  }
  if (token) {
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: channel || env('SLACK_CHANNEL'), text: text || '' }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'slack api failed');
    return { sent: true };
  }
  return { sent: false, reason: 'queue_only', note: 'Slack secrets missing' };
}

async function sendSms({ to, body }) {
  if (skip('sms')) return { sent: false, reason: 'queue_only' };
  const sid = env('TWILIO_ACCOUNT_SID', 'twilio_account_sid');
  const token = env('TWILIO_AUTH_TOKEN', 'twilio_auth_token');
  const from = env('TWILIO_FROM', 'twilio_from');
  if (!sid || !token || !from) return { sent: false, reason: 'queue_only', note: 'Twilio secrets missing' };
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body || '' });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!r.ok) throw new Error(`twilio ${r.status}`);
  return { sent: true };
}

async function sendPush({ to, title, body }) {
  if (skip('push')) return { sent: false, reason: 'queue_only' };
  const key = env('FCM_SERVER_KEY', 'fcm_server_key');
  if (!key || !to) return { sent: false, reason: 'queue_only', note: 'FCM secret or token missing' };
  const r = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { Authorization: `key=${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, notification: { title: title || 'Aerekos', body: body || '' } }),
  });
  if (!r.ok) throw new Error(`fcm ${r.status}`);
  return { sent: true };
}

module.exports = { sendEmail, sendSlack, sendSms, sendPush, skip };
