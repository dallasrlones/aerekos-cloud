const { checkConfig, isSkip } = require('../../shared/cloudflareReadiness');

describe('cloudflareReadiness', () => {
  const prev = {};

  beforeEach(() => {
    for (const k of ['NODE_ENV', 'SKIP_CLOUDFLARE', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
      prev[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test('refuses SKIP_CLOUDFLARE mock in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_CLOUDFLARE = '1';
    expect(() => checkConfig()).toThrow(/SKIP_CLOUDFLARE/);
  });

  test('allows mock skip outside production', () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_CLOUDFLARE = '1';
    const cfg = checkConfig();
    expect(isSkip()).toBe(true);
    expect(cfg.mode).toBe('mock');
    expect(cfg.ready).toBe(true);
  });
});
