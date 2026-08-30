const { upsertEnvLine, mergeProjectSecretsIntoConfig, SECRET_NAME_TO_ENV_BY_SERVICE } = require('../../api/services/projectSecretEnv');

describe('projectSecretEnv', () => {
  it('upsertEnvLine replaces existing key', () => {
    const out = upsertEnvLine(['FOO=1', 'CLOUDFLARE_API_TOKEN=old'], 'CLOUDFLARE_API_TOKEN', 'new');
    expect(out).toContain('FOO=1');
    expect(out).toContain('CLOUDFLARE_API_TOKEN=new');
    expect(out.filter((l) => l.startsWith('CLOUDFLARE_API_TOKEN=')).length).toBe(1);
  });

  it('exposes expected Cloudflare mappings for edge services', () => {
    expect(SECRET_NAME_TO_ENV_BY_SERVICE.tunnel_manager.cloudflare_api_token).toBe('CLOUDFLARE_API_TOKEN');
    expect(SECRET_NAME_TO_ENV_BY_SERVICE.domain_manager.cloudflare_zone_id).toBe('CLOUDFLARE_ZONE_ID');
  });
});

describe('mergeProjectSecretsIntoConfig (mocked HTTP)', () => {
  const axios = require('axios');
  const origGet = axios.get;
  afterEach(() => {
    axios.get = origGet;
  });
  it('injects values from list + reveal', async () => {
    axios.get = jest.fn((url) => {
      if (url.includes('/v1/secrets') && !url.match(/\/secrets\/[^/]+$/)) {
        return Promise.resolve({
          status: 200,
          data: { secrets: [{ id: 's1', name: 'cloudflare_api_token' }] }
        });
      }
      if (url.includes('/secrets/s1')) {
        return Promise.resolve({
          status: 200,
          data: { secret: { name: 'cloudflare_api_token', value: 'tok-v' } }
        });
      }
      return Promise.resolve({ status: 404, data: {} });
    });
    const cfg = { environment: [] };
    const r = await mergeProjectSecretsIntoConfig({
      serviceName: 'tunnel_manager',
      projectId: 'p1',
      serviceConfig: cfg,
      bearerToken: 't'
    });
    expect(r.injected).toBe(1);
    expect(cfg.environment.join('')).toContain('CLOUDFLARE_API_TOKEN=tok-v');
  });
});
