'use strict';

jest.mock('../../shared/outboundSend', () => ({
  sendEmail: jest.fn(async () => ({ sent: false, reason: 'queue_only' })),
  sendSms: jest.fn(async () => ({ sent: false, reason: 'queue_only' })),
  sendSlack: jest.fn(async () => ({ sent: false, reason: 'queue_only' })),
  sendPush: jest.fn(async () => ({ sent: false, reason: 'queue_only' })),
}));

const outbound = require('../../shared/outboundSend');
const { WorkflowRunner } = require('../../workflow_manager/api/services/WorkflowRunner');

describe('WorkflowRunner notify steps', () => {
  const runner = new WorkflowRunner({});

  test.each(['email', 'sms', 'slack', 'push'])('step type %s calls outboundSend', async (type) => {
    const out = await runner.runStep({ type, to: 'x', text: 'hi' }, {}, 'proj');
    expect(out.type).toBe(type);
    const fn = type === 'email' ? outbound.sendEmail
      : type === 'sms' ? outbound.sendSms
      : type === 'push' ? outbound.sendPush
      : outbound.sendSlack;
    expect(fn).toHaveBeenCalled();
  });
});
