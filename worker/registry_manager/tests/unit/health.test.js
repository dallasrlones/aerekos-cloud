const { RegistryConfigService } = require('../../api/services/RegistryConfigService');
const { inWindow } = require('../../api/services/RegistryOpsService');

describe('RegistryConfigService', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.REGISTRY_MODE = prev.REGISTRY_MODE;
    process.env.REGISTRY_PUBLIC_BASE_URL = prev.REGISTRY_PUBLIC_BASE_URL;
    process.env.REGISTRY_DEFAULT_NAMESPACE = prev.REGISTRY_DEFAULT_NAMESPACE;
    process.env.REGISTRY_AUTH_EXPECTED = prev.REGISTRY_AUTH_EXPECTED;
  });

  test('returns public shape without secrets', () => {
    process.env.REGISTRY_MODE = 'harbor';
    process.env.REGISTRY_PUBLIC_BASE_URL = 'https://harbor.example.com';
    process.env.REGISTRY_DEFAULT_NAMESPACE = 'aerekos';
    process.env.REGISTRY_AUTH_EXPECTED = '1';
    const cfg = new RegistryConfigService().getPublicConfig();
    expect(cfg).toMatchObject({
      mode: 'harbor',
      public_base_url: 'https://harbor.example.com',
      default_namespace: 'aerekos',
      auth_expected: true,
    });
    expect(cfg).not.toHaveProperty('password');
    expect(cfg.docs).toBeDefined();
  });

  test('unknown mode falls back to custom', () => {
    process.env.REGISTRY_MODE = 'not-a-real-mode';
    expect(new RegistryConfigService().getPublicConfig().mode).toBe('custom');
  });
});

describe('inWindow', () => {
  test('empty window is always open', () => {
    expect(inWindow('')).toBe(true);
    expect(inWindow(null)).toBe(true);
  });

  test('parses HH:MM-HH:MM against a fixed clock', () => {
    const noon = new Date('2026-01-15T12:00:00');
    expect(inWindow('11:00-13:00', noon)).toBe(true);
    expect(inWindow('13:00-14:00', noon)).toBe(false);
  });
});
