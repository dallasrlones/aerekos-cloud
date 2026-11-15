'use strict';

const { mintSelfSignedPem, parseImportedPem } = require('../../api/services/mintPem');

describe('mintPem', () => {
  test('mintSelfSignedPem returns PEM cert + private key', () => {
    const minted = mintSelfSignedPem('app.example.test');
    expect(minted.cn).toBe('app.example.test');
    expect(minted.pem).toMatch(/BEGIN CERTIFICATE/);
    expect(minted.pem).toMatch(/BEGIN PRIVATE KEY/);
    expect(minted.cert).toMatch(/BEGIN CERTIFICATE/);
    expect(minted.key).toMatch(/BEGIN PRIVATE KEY/);
  });

  test('parseImportedPem accepts PEM and normalizes trailing newline', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----';
    expect(parseImportedPem(pem)).toBe(`${pem}\n`);
  });

  test('parseImportedPem rejects non-PEM', () => {
    expect(() => parseImportedPem('not-a-pem')).toThrow(/PEM required/);
  });
});
