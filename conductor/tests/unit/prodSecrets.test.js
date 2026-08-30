'use strict';

const { assertProdSecrets } = require('../../api/utils/prodSecrets');

describe('assertProdSecrets', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = prev.NODE_ENV;
    process.env.JWT_SECRET = prev.JWT_SECRET;
    process.env.TOKEN_SECRET = prev.TOKEN_SECRET;
  });

  test('no-op outside production', () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'change-me';
    process.env.TOKEN_SECRET = 'change-me';
    expect(() => assertProdSecrets()).not.toThrow();
  });

  test('throws on dummy TOKEN_SECRET in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-real-jwt-secret-value-32chars!!';
    process.env.TOKEN_SECRET = 'change-me';
    expect(() => assertProdSecrets()).toThrow(/TOKEN_SECRET/);
  });

  test('accepts non-dummy secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-real-jwt-secret-value-32chars!!';
    process.env.TOKEN_SECRET = 'a-real-token-secret-value-32ch!!';
    expect(() => assertProdSecrets()).not.toThrow();
  });
});
