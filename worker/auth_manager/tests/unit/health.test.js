'use strict';

process.env.AUTH_MANAGER_SECRET = process.env.AUTH_MANAGER_SECRET || 'unit-test-signing-secret';
process.env.SKIP_SERVICE_REGISTRATION = 'true';

const TokenService = require('../../api/services/TokenService');

describe('TokenService', () => {
  test('sign + verify round-trip', () => {
    const token = TokenService.sign({ sub: 'unit', typ: 'service', scope: '*' }, 60);
    const claims = TokenService.verify(token);
    expect(claims.sub).toBe('unit');
    expect(claims.typ).toBe('service');
    expect(claims.iss).toBe(TokenService.issuer);
  });

  test('verify rejects garbage', () => {
    expect(() => TokenService.verify('not.a.jwt')).toThrow(/invalid_token/);
  });

  test('issuer is aerekos-auth_manager', () => {
    expect(TokenService.issuer).toBe('aerekos-auth_manager');
  });
});
