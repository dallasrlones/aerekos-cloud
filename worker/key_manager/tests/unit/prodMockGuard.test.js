'use strict';

/**
 * Production must never boot with a missing or all-zero MASTER_KEY.
 * Mirrors the boot guards in index.js.
 */
describe('no prod mocks / weak master key', () => {
  const wouldExitMissing = (masterKey) => !masterKey;

  const wouldExitAllZeroProd = (nodeEnv, masterKey) =>
    nodeEnv === 'production' && /^0+$/.test(String(masterKey || ''));

  test('missing MASTER_KEY always refuses boot', () => {
    expect(wouldExitMissing(undefined)).toBe(true);
    expect(wouldExitMissing('')).toBe(true);
    expect(wouldExitMissing('a1b2c3d4e5f67890123456789012345678901234567890123456789012345678')).toBe(false);
  });

  test('all-zero MASTER_KEY is forbidden when NODE_ENV=production', () => {
    expect(wouldExitAllZeroProd('production', '0000000000000000000000000000000000000000000000000000000000000000')).toBe(true);
    expect(wouldExitAllZeroProd('production', 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678')).toBe(false);
    expect(wouldExitAllZeroProd('development', '0000000000000000000000000000000000000000000000000000000000000000')).toBe(false);
    expect(wouldExitAllZeroProd('test', '0000000000000000000000000000000000000000000000000000000000000000')).toBe(false);
  });

  test('index.js encodes the production all-zero guard', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../index.js'),
      'utf8'
    );
    expect(src).toMatch(/NODE_ENV === 'production'/);
    expect(src).toMatch(/\^0\+\$/);
    expect(src).toMatch(/all-zero dummy/);
  });
});
