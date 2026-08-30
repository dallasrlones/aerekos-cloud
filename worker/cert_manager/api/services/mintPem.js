'use strict';

const crypto = require('crypto');

function encodeLength(len) {
  if (len < 128) return Buffer.from([len]);
  const bytes = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag, contents) {
  const buf = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  return Buffer.concat([Buffer.from([tag]), encodeLength(buf.length), buf]);
}

function integerFromBuf(buf) {
  let b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
  return tlv(0x02, b);
}

function oid(str) {
  const parts = str.split('.').map(Number);
  const body = [40 * parts[0] + parts[1]];
  for (const part of parts.slice(2)) {
    if (part < 128) body.push(part);
    else {
      const stack = [part & 0x7f];
      let v = Math.floor(part / 128);
      while (v > 0) {
        stack.push((v & 0x7f) | 0x80);
        v = Math.floor(v / 128);
      }
      while (stack.length) body.push(stack.pop());
    }
  }
  return tlv(0x06, Buffer.from(body));
}

function utcTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = String(d.getUTCFullYear()).slice(-2);
  const s = `${y}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return tlv(0x17, Buffer.from(s, 'ascii'));
}

function toPem(type, der) {
  const b64 = der.toString('base64').match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${type}-----\n${b64}\n-----END ${type}-----\n`;
}

function mintSelfSignedPem(cn, { days = 365 } = {}) {
  const host = String(cn || 'localhost').trim() || 'localhost';
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  const now = new Date();
  const exp = new Date(now.getTime() + days * 86400 * 1000);
  const cnAttr = tlv(0x30, Buffer.concat([
    oid('2.5.4.3'),
    tlv(0x13, Buffer.from(host.slice(0, 64), 'ascii')),
  ]));
  const name = tlv(0x30, tlv(0x31, cnAttr));
  const algo = tlv(0x30, Buffer.concat([oid('1.2.840.113549.1.1.11'), tlv(0x05, Buffer.alloc(0))]));

  const tbs = tlv(0x30, Buffer.concat([
    tlv(0xa0, integerFromBuf(Buffer.from([0x02]))),
    integerFromBuf(crypto.randomBytes(8)),
    algo,
    name,
    tlv(0x30, Buffer.concat([utcTime(now), utcTime(exp)])),
    name,
    pubDer,
  ]));

  const sig = crypto.sign('sha256', tbs, privateKey);
  const certDer = tlv(0x30, Buffer.concat([
    tbs,
    algo,
    tlv(0x03, Buffer.concat([Buffer.from([0x00]), sig])),
  ]));
  const certPem = toPem('CERTIFICATE', certDer);
  return { pem: `${certPem}${keyPem}`, cert: certPem, key: keyPem, cn: host };
}

function parseImportedPem(pem) {
  const text = String(pem || '').trim();
  if (!text.includes('-----BEGIN')) {
    const e = new Error('PEM required');
    e.status = 400;
    throw e;
  }
  return text.endsWith('\n') ? text : `${text}\n`;
}

module.exports = { mintSelfSignedPem, parseImportedPem };
