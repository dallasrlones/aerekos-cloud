'use strict';

const ServiceManager = require('../../api/services/ServiceManager');
const { notify } = require('../../api/services/AlertFanout');

describe('AlertFanout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('no project → skipped', async () => {
    const prev = process.env.DEFAULT_PROJECT_ID;
    delete process.env.DEFAULT_PROJECT_ID;
    const r = await notify(null, { title: 'x', body: 'y' });
    expect(r.skipped).toBe(true);
    process.env.DEFAULT_PROJECT_ID = prev;
  });

  test('fans out slack/email/sms/push payload shape', async () => {
    const proxy = jest.fn(async () => ({ data: { item: { id: '1' } } }));
    jest.spyOn(ServiceManager, 'getInstance').mockReturnValue({ proxyServiceRequest: proxy });
    const r = await notify('proj-1', { title: 'down', body: 'worker x', severity: 'error' });
    expect(r.results).toHaveLength(4);
    expect(r.results.every((x) => x.ok)).toBe(true);
    const services = proxy.mock.calls.map((c) => c[0]);
    expect(services).toEqual(expect.arrayContaining([
      'slack_manager',
      'email_manager',
      'sms_manager',
      'push_manager',
    ]));
  });
});
