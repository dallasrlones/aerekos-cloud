'use strict';

const {
  MockProvider,
  normalizeEmailRequest,
  normalizeSmsRequest,
  normalizeSlackRequest,
  legacyManagerPayload,
} = require('../../shared/notifyProviders');
const { notify, notifyFanout } = require('../../shared/notifyFacade');

describe('W9a notify provider contracts', () => {
  test('email request shape', () => {
    const req = normalizeEmailRequest({
      to_address: 'ops@example.test',
      subject: 'hi',
      body: 'body',
    });
    expect(req).toEqual({
      channel: 'email',
      to: 'ops@example.test',
      subject: 'hi',
      body: 'body',
    });
  });

  test('sms request shape (Twilio-style E.164)', () => {
    const req = normalizeSmsRequest({ to: '+15555550100', body: 'ping' });
    expect(req.channel).toBe('sms');
    expect(req.to).toBe('+15555550100');
    expect(req.body).toBe('ping');
  });

  test('slack request shape', () => {
    const req = normalizeSlackRequest({ text: 'hello', channel: '#ops' });
    expect(req).toMatchObject({ channel: 'slack', text: 'hello', slack_channel: '#ops' });
  });

  test('MockProvider captures without network', async () => {
    const mock = new MockProvider();
    const req = mock.normalize('sms', { to: '+15555550123', body: 'x' });
    const out = await mock.send('sms', req);
    expect(out.mock).toBe(true);
    expect(out.sent).toBe(false);
    expect(mock.calls[0].request.body).toBe('x');
    expect(mock.calls[0].request.to).toBe('+15555550123');
  });

  test('legacyManagerPayload matches email_manager CRUD', () => {
    const normalized = normalizeEmailRequest({
      to_address: 'a@b.test',
      subject: 's',
      body: 'b',
    });
    const spec = legacyManagerPayload('email', 'proj-1', normalized, { name: 'alert-1' });
    expect(spec.manager).toBe('email_manager');
    expect(spec.body).toMatchObject({
      project_id: 'proj-1',
      name: 'alert-1',
      to_address: 'a@b.test',
      status: 'queued',
    });
  });

  test('notify facade delegates then mock-sends', async () => {
    const delegated = [];
    const res = await notify({
      projectId: 'proj-9',
      channel: 'slack',
      payload: { text: 'deploy done' },
      useMock: true,
      send: true,
      delegate: async (spec) => {
        delegated.push(spec);
        return { queued: true };
      },
    });
    expect(delegated).toHaveLength(1);
    expect(delegated[0].manager).toBe('slack_manager');
    expect(res.sendResult.mock).toBe(true);
    expect(res.normalized.text).toBe('deploy done');
  });

  test('notifyFanout builds per-channel payloads', async () => {
    const res = await notifyFanout('p', {
      title: 'cpu',
      body: 'high',
      channels: ['email'],
      useMock: true,
    });
    expect(res.results).toHaveLength(1);
    expect(res.results[0].normalized.subject).toBe('cpu');
  });
});
