'use strict';

const { SecretService } = require('../../api/services/SecretService');

describe('SecretService validation', () => {
  const svc = new SecretService({
    StoredSecret: {},
    crypto: { keyName: () => 'k' },
  });

  test('assertProjectId rejects empty', () => {
    expect(() => svc.assertProjectId('')).toThrow(/project_id/);
    try {
      svc.assertProjectId(null);
    } catch (e) {
      expect(e.status).toBe(400);
    }
  });

  test('validateName accepts and rejects', () => {
    expect(svc.validateName('cloudflare_api_token')).toBe('cloudflare_api_token');
    expect(() => svc.validateName('1bad')).toThrow(/name/);
    expect(() => svc.validateName('')).toThrow(/name/);
  });

  test('envName defaults to prod', () => {
    expect(svc.envName({})).toBe('prod');
    expect(svc.envName({ environment: 'dev' })).toBe('dev');
    expect(svc.envName({ env: 'staging' })).toBe('staging');
  });

  test('normalizeMetadata stringifies objects', () => {
    expect(svc.normalizeMetadata(null)).toBe('');
    expect(svc.normalizeMetadata('x')).toBe('x');
    expect(svc.normalizeMetadata({ a: 1 })).toBe('{"a":1}');
  });
});
