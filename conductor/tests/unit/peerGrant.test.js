'use strict';

const crypto = require('crypto');
const { signGrant, verifyGrant, decodeGrant } = require('../../api/utils/peerGrant');

describe('peerGrant sign/verify', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

  test('signs and verifies a federation grant', () => {
    const { token, jti, payload } = signGrant(privatePem, {
      home_peer_id: 'peer-home',
      project_id: 'proj-1',
      role: 'member',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(token.split('.')).toHaveLength(3);
    expect(jti).toBeTruthy();
    expect(payload.project_id).toBe('proj-1');

    const verified = verifyGrant(publicPem, token);
    expect(verified.jti).toBe(jti);
    expect(verified.home_peer_id).toBe('peer-home');
    expect(verified.role).toBe('member');
  });

  test('rejects tampered payload', () => {
    const { token } = signGrant(privatePem, {
      home_peer_id: 'peer-home',
      project_id: 'proj-1',
      role: 'viewer',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const parts = token.split('.');
    const badPayload = Buffer.from(JSON.stringify({
      ...decodeGrant(token).payload,
      role: 'owner',
    })).toString('base64url');
    const tampered = `${parts[0]}.${badPayload}.${parts[2]}`;
    expect(() => verifyGrant(publicPem, tampered)).toThrow(/signature/i);
  });

  test('rejects expired grant', () => {
    const { token } = signGrant(privatePem, {
      home_peer_id: 'peer-home',
      project_id: 'proj-1',
      role: 'member',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(() => verifyGrant(publicPem, token)).toThrow(/expired/i);
  });
});
