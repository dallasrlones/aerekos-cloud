'use strict';

describe('function poller ack rule', () => {
  test('does not treat HTTP 200 + result.error as success', () => {
    const invoked = { status: 200, result: { error: 'handler exploded' } };
    const failed = Boolean(!invoked
      || invoked.status === 'failed'
      || invoked.error
      || (invoked.result && invoked.result.error));
    expect(failed).toBe(true);
  });

  test('acks only when invoke succeeded without result.error', () => {
    const invoked = { status: 200, result: { ok: true } };
    const failed = Boolean(!invoked
      || invoked.status === 'failed'
      || invoked.error
      || (invoked.result && invoked.result.error));
    expect(failed).toBe(false);
  });
});
