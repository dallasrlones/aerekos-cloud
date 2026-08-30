const { buildServiceProxyPath } = require('../../api/utils/buildServiceProxyPath');

describe('buildServiceProxyPath', () => {
  it('maps key_manager list path', () => {
    expect(buildServiceProxyPath('key_manager', '/key_manager/api/keys')).toBe('/api/keys');
  });

  it('defaults key_manager root to /api/keys', () => {
    expect(buildServiceProxyPath('key_manager', '/key_manager/api')).toBe('/api/keys');
  });

  it('maps secrets_manager v1 list', () => {
    expect(buildServiceProxyPath('secrets_manager', '/secrets_manager/api/v1/secrets')).toBe(
      '/api/v1/secrets'
    );
  });

  it('maps queue_manager v1', () => {
    expect(buildServiceProxyPath('queue_manager', '/queue_manager/api/v1/queues')).toBe(
      '/api/v1/queues'
    );
  });

  it('maps logs_manager batch', () => {
    expect(
      buildServiceProxyPath('logs_manager', '/logs_manager/api/v1/logs/batch')
    ).toBe('/api/v1/logs/batch');
  });
});
