'use strict';

const { generateSecret, verifyTotp, hotp } = require('../../api/utils/totp');

describe('totp', () => {
  test('verifies a code for the current window', () => {
    const secret = generateSecret();
    const key = Buffer.from(secret, 'hex');
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = hotp(key, counter);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
  });
});
