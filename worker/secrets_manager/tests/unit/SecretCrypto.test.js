'use strict';

const { SecretCrypto } = require('../../api/services/SecretCrypto');

describe('SecretCrypto', () => {
  const cryptoSvc = new SecretCrypto();

  test('keyName defaults to secrets-envelope-key', () => {
    const prev = process.env.SECRETS_ENCRYPTION_KEY_NAME;
    delete process.env.SECRETS_ENCRYPTION_KEY_NAME;
    expect(cryptoSvc.keyName()).toBe('secrets-envelope-key');
    process.env.SECRETS_ENCRYPTION_KEY_NAME = prev;
  });

  test('MOCK_KEY_MANAGER encrypt/decrypt roundtrip', async () => {
    process.env.MOCK_KEY_MANAGER = 'true';
    const plain = Buffer.from('unit-secret-value', 'utf8');
    const { buf, keyVersion } = await cryptoSvc.encryptBuffer(plain, 'secrets-envelope-key', 'proj-1');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(32);
    expect(keyVersion).toBe(1);
    const out = await cryptoSvc.decryptBuffer(buf, 'secrets-envelope-key', 'proj-1');
    expect(out.toString('utf8')).toBe('unit-secret-value');
  });

  test('getEncryptionKey requires projectId', async () => {
    process.env.MOCK_KEY_MANAGER = 'true';
    await expect(cryptoSvc.getEncryptionKey('k', null)).rejects.toThrow(/projectId/);
  });

  test('without mock, missing CONDUCTOR_URL yields 503', async () => {
    const prevMock = process.env.MOCK_KEY_MANAGER;
    const prevUrl = process.env.CONDUCTOR_URL;
    process.env.MOCK_KEY_MANAGER = 'false';
    delete process.env.CONDUCTOR_URL;
    const svc = new SecretCrypto({ conductorUrl: '', serviceToken: 'tok' });
    try {
      await svc.getEncryptionKey('k', 'proj-1');
      throw new Error('expected throw');
    } catch (e) {
      expect(e.status).toBe(503);
      expect(e.message).toMatch(/CONDUCTOR_URL/);
    } finally {
      process.env.MOCK_KEY_MANAGER = prevMock;
      if (prevUrl == null) delete process.env.CONDUCTOR_URL;
      else process.env.CONDUCTOR_URL = prevUrl;
    }
  });
});
