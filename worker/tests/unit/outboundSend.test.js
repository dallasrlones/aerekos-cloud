'use strict';

const outbound = require('../../shared/outboundSend');

describe('outboundSend', () => {
  const prev = { ...process.env };

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in prev)) delete process.env[k];
    }
    Object.assign(process.env, prev);
    delete process.env.SKIP_OUTBOUND;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.FCM_SERVER_KEY;
  });

  test('missing secrets → queue-only (no network)', async () => {
    delete process.env.SKIP_OUTBOUND;
    delete process.env.SMTP_HOST;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.FCM_SERVER_KEY;
    const email = await outbound.sendEmail({ to: 'a@b.c', subject: 'x', body: 'y' });
    const slack = await outbound.sendSlack({ text: 'hi' });
    const sms = await outbound.sendSms({ to: '+1', body: 'z' });
    const push = await outbound.sendPush({ to: 'tok', title: 't', body: 'b' });
    expect(email).toMatchObject({ sent: false, reason: 'queue_only' });
    expect(slack).toMatchObject({ sent: false, reason: 'queue_only' });
    expect(sms).toMatchObject({ sent: false, reason: 'queue_only' });
    expect(push).toMatchObject({ sent: false, reason: 'queue_only' });
  });

  test('SKIP_OUTBOUND forces queue even when secrets exist', async () => {
    process.env.SKIP_OUTBOUND = '1';
    process.env.SMTP_HOST = 'smtp.example';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const email = await outbound.sendEmail({ to: 'a@b.c', subject: 'x', body: 'y' });
    expect(email).toEqual({ sent: false, reason: 'queue_only' });
  });

  test('secrets present without SKIP still queue if nodemailer missing / skip flags', async () => {
    process.env.SKIP_SMTP = '1';
    process.env.SMTP_HOST = 'smtp.example';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    const email = await outbound.sendEmail({ to: 'a@b.c', subject: 'x', body: 'y' });
    expect(email.sent).toBe(false);
  });
});
