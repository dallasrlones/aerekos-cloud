'use strict';

const { TunnelService } = require('../../api/services/TunnelService');

describe('TunnelService.mergeRules', () => {
  const svc = new TunnelService({ client: { putIngress: jest.fn() } });

  test('keeps cloud.aerekos.com and catch-all last', () => {
    const next = svc.mergeRules(
      [
        { hostname: 'cloud.aerekos.com', service: 'http://localhost:19006' },
        { hostname: 'cloudapi.aerekos.com', service: 'http://localhost:3300' },
        { service: 'http_status:404' },
      ],
      'git.aerekos.com',
      'http://localhost:3130',
    );
    expect(next.find((r) => r.hostname === 'cloud.aerekos.com')?.service).toBe('http://localhost:19006');
    expect(next.find((r) => r.hostname === 'git.aerekos.com')?.service).toBe('http://localhost:3130');
    expect(next[next.length - 1].service).toBe('http_status:404');
    expect(next.filter((r) => String(r.service || '').includes('http_status')).length).toBe(1);
  });
});
