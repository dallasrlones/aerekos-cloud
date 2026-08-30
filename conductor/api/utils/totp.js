'use strict';

const crypto = require('crypto');

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input || '').toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of clean) {
    const v = alphabet.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1000000).padStart(6, '0');
}

function generateSecret() {
  return crypto.randomBytes(10).toString('hex').toUpperCase();
}

function verifyTotp(secret, token, { window = 1, step = 30 } = {}) {
  if (!secret || !token) return false;
  const presented = String(token).replace(/\s/g, '');
  if (!/^\d{6}$/.test(presented)) return false;
  let key;
  try {
    key = /^[0-9A-F]+$/i.test(secret) && secret.length % 2 === 0
      ? Buffer.from(secret, 'hex')
      : base32Decode(secret);
  } catch {
    return false;
  }
  const counter = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i += 1) {
    if (hotp(key, counter + i) === presented) return true;
  }
  return false;
}

module.exports = { generateSecret, verifyTotp, hotp };
