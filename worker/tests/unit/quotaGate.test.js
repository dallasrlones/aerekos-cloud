'use strict';

jest.mock('../../shared/conductorProxy', () => ({
  proxy: jest.fn(),
}));

const { proxy } = require('../../shared/conductorProxy');
const { assertQuota } = require('../../shared/quotaGate');

describe('quotaGate', () => {
  const prevSkip = process.env.SKIP_QUOTA;

  afterEach(() => {
    process.env.SKIP_QUOTA = prevSkip;
    jest.clearAllMocks();
  });

  test('SKIP_QUOTA skips evaluate', async () => {
    process.env.SKIP_QUOTA = '1';
    const r = await assertQuota('p1', 'storage_bytes');
    expect(r.skipped).toBe(true);
    expect(proxy).not.toHaveBeenCalled();
  });

  test('deny posts slack and throws 429', async () => {
    delete process.env.SKIP_QUOTA;
    proxy.mockImplementation(async (opts) => {
      if (opts.path === '/api/v1/evaluate-quota') return { allowed: false };
      return { item: { id: 'msg-1' } };
    });
    await expect(assertQuota('p1', 'compute_tasks')).rejects.toMatchObject({
      status: 429,
      code: 'QUOTA_EXCEEDED',
    });
    expect(proxy).toHaveBeenCalledWith(expect.objectContaining({
      service: 'slack_manager',
      path: '/api/v1/messages',
    }));
  });

  test('billing missing fail-open', async () => {
    delete process.env.SKIP_QUOTA;
    proxy.mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await assertQuota('p1', 'storage_bytes');
    expect(r.allowed).toBe(true);
    expect(r.skipped).toBe(true);
  });
});
