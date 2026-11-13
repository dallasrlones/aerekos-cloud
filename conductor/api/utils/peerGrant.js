'use strict';

const crypto = require('crypto');

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(typeof input === 'string' ? input : JSON.stringify(input));
  return buf.toString('base64url');
}

function fromB64url(str) {
  return Buffer.from(String(str), 'base64url');
}

/**
 * Sign a federation grant JWT (EdDSA / Ed25519).
 * claims: { home_peer_id, project_id, role, exp, jti?, sub? }
 */
function signGrant(privateKeyPem, claims = {}) {
  const jti = claims.jti || crypto.randomBytes(16).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: 'federation_grant',
    home_peer_id: String(claims.home_peer_id || ''),
    project_id: String(claims.project_id || ''),
    role: String(claims.role || 'member'),
    jti,
    iat: now,
    exp: Number(claims.exp) || now + 7 * 24 * 3600,
  };
  if (claims.sub) payload.sub = String(claims.sub);
  const header = { alg: 'EdDSA', typ: 'JWT' };
  const data = `${b64url(header)}.${b64url(payload)}`;
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(data), key);
  return {
    token: `${data}.${b64url(sig)}`,
    jti,
    payload,
  };
}

function decodeGrant(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    const err = new Error('invalid grant token');
    err.status = 400;
    throw err;
  }
  const header = JSON.parse(fromB64url(parts[0]).toString('utf8'));
  const payload = JSON.parse(fromB64url(parts[1]).toString('utf8'));
  return { header, payload, data: `${parts[0]}.${parts[1]}`, signature: parts[2] };
}

/**
 * Verify grant signature with home peer public key (SPKI PEM or raw base64).
 */
function verifyGrant(publicKeyPem, token, { now = Math.floor(Date.now() / 1000) } = {}) {
  const { header, payload, data, signature } = decodeGrant(token);
  if (header.alg !== 'EdDSA') {
    const err = new Error('unsupported grant algorithm');
    err.status = 400;
    throw err;
  }
  let key;
  try {
    key = crypto.createPublicKey(publicKeyPem);
  } catch (_) {
    const err = new Error('invalid peer public key');
    err.status = 400;
    throw err;
  }
  const ok = crypto.verify(null, Buffer.from(data), key, fromB64url(signature));
  if (!ok) {
    const err = new Error('invalid grant signature');
    err.status = 401;
    throw err;
  }
  if (payload.typ && payload.typ !== 'federation_grant') {
    const err = new Error('not a federation grant');
    err.status = 400;
    throw err;
  }
  if (payload.exp && Number(payload.exp) < now) {
    const err = new Error('grant expired');
    err.status = 410;
    throw err;
  }
  return payload;
}

module.exports = {
  signGrant,
  verifyGrant,
  decodeGrant,
};
