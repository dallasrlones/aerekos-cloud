const axios = require('axios');
const crypto = require('crypto');

/**
 * Envelope-encrypts secret bytes using a data key from key_manager (via conductor),
 * same AES-256-GCM layout as storage_manager EncryptionService (IV + CT + tag).
 */
class SecretCrypto {
  constructor(opts = {}) {
    this.conductorUrl = opts.conductorUrl || process.env.CONDUCTOR_URL;
    this.serviceToken = opts.serviceToken || process.env.SERVICE_TOKEN;
    this.http = opts.http || axios;
  }

  keyName() {
    return process.env.SECRETS_ENCRYPTION_KEY_NAME || 'secrets-envelope-key';
  }

  async getEncryptionKey(keyName, projectId) {
    if (!projectId) {
      throw new Error('projectId is required to fetch encryption key');
    }
    if (process.env.MOCK_KEY_MANAGER === 'true') {
      const material =
        process.env.MOCK_KEY_MATERIAL ||
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      return {
        key_name: keyName,
        key_material: material,
        key_version: 1,
        algorithm: 'AES-256-GCM'
      };
    }
    if (!this.conductorUrl) {
      const e = new Error('CONDUCTOR_URL is required to reach key_manager (or set MOCK_KEY_MANAGER=true)');
      e.status = 503;
      throw e;
    }
    if (!this.serviceToken) {
      const e = new Error('SERVICE_TOKEN is required to reach key_manager (or set MOCK_KEY_MANAGER=true)');
      e.status = 503;
      throw e;
    }
    const { data } = await this.http.get(
      `${this.conductorUrl}/api/services/key_manager/api/keys/${encodeURIComponent(
        keyName
      )}?project_id=${encodeURIComponent(projectId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    return data;
  }

  toKeyBuffer(km) {
    if (km.key_material.length === 64) {
      return Buffer.from(km.key_material, 'hex');
    }
    return Buffer.from(String(km.key_material).substring(0, 32).padEnd(32, '0'));
  }

  async encryptBuffer(plain, keyName, projectId) {
    const km = await this.getEncryptionKey(keyName, projectId);
    const keyBuffer = this.toKeyBuffer(km);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { buf: Buffer.concat([iv, enc, tag]), keyVersion: km.key_version == null ? 1 : km.key_version };
  }

  async decryptBuffer(encBuf, keyName, projectId) {
    const km = await this.getEncryptionKey(keyName, projectId);
    const keyBuffer = this.toKeyBuffer(km);
    const iv = encBuf.slice(0, 16);
    const tag = encBuf.slice(-16);
    const data = encBuf.slice(16, -16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}

module.exports = { SecretCrypto };
