const axios = require('axios');
const crypto = require('crypto');
const { Transform } = require('stream');
const logger = require('../utils/logger');
const { GCM_CHUNK_SIZE } = require('./DecryptingStream');

class EncryptionService {
  constructor(conductorUrl, serviceToken) {
    this.conductorUrl = conductorUrl;
    this.serviceToken = serviceToken;
  }
  
  /**
   * Get encryption key from key_manager via conductor
   * @param {string} keyName - Key name (e.g., 'storage-encryption-key')
   * @param {string} projectId - Project ID (required for project-scoped keys)
   * @returns {Promise<object>} Key object with decrypted key material
   */
  async getEncryptionKey(keyName, projectId) {
    // projectId may be null for system-scoped buckets (global keys, no ?project_id= param)
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
      throw new Error('CONDUCTOR_URL not configured - cannot connect to key_manager');
    }

    if (!this.serviceToken) {
      throw new Error('Service token not available - cannot authenticate with key_manager');
    }

    try {
      const keyUrl = projectId
        ? `${this.conductorUrl}/api/services/key_manager/api/keys/${keyName}?project_id=${encodeURIComponent(projectId)}`
        : `${this.conductorUrl}/api/services/key_manager/api/keys/${keyName}`;
      const response = await axios.get(
        keyUrl,
        {
          headers: {
            'Authorization': `Bearer ${this.serviceToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      
      // key_manager's getKey() returns the decrypted key_material for service use
      // The key_material is already decrypted by key_manager using the master key
      return response.data;
    } catch (error) {
      logger.error(`[EncryptionService] Failed to get encryption key '${keyName}' for project '${projectId}':`, error.response?.data || error.message);
      if (error.response?.status === 404) {
        throw new Error(`Encryption key '${keyName}' not found in key_manager`);
      }
      if (error.response?.status === 400) {
        throw new Error(`Failed to get encryption key: ${error.response?.data?.error?.message || error.message}`);
      }
      throw new Error(`Failed to get encryption key: ${error.message}`);
    }
  }
  
  /**
   * Convert key_manager key material to a 32-byte AES-256 key Buffer.
   *
   * 64-character material is treated as hex (32 raw bytes); anything else is
   * treated as a raw string, truncated/padded to 32 bytes (legacy behavior).
   * @param {object} key - Key object from key_manager (must have key_material)
   * @returns {Buffer} 32-byte AES-256 key
   */
  keyMaterialToBuffer(key) {
    if (!key || typeof key.key_material !== 'string') {
      throw new Error('Encryption key missing key_material');
    }
    if (key.key_material.length === 64) {
      return Buffer.from(key.key_material, 'hex');
    }
    return Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
  }

  /**
   * Fetch a key from key_manager and return it as a 32-byte AES-256 key Buffer.
   * @param {string} keyName - Key name in key_manager
   * @param {string} projectId - Project ID (required for project-scoped keys)
   * @returns {Promise<Buffer>} 32-byte AES-256 key
   */
  async getKeyBuffer(keyName, projectId) {
    const key = await this.getEncryptionKey(keyName, projectId);
    return this.keyMaterialToBuffer(key);
  }

  /**
   * Encrypt a stream using a key from key_manager
   * @param {stream.Readable} inputStream - Data to encrypt
   * @param {string} keyName - Key name from key_manager
   * @param {string} projectId - Project ID (required for project-scoped keys)
   * @returns {Promise<stream.Transform>} Encrypted stream transform
   */
  async encryptStream(inputStream, keyName, projectId) {
    const key = await this.getEncryptionKey(keyName, projectId);
    const keyBuffer = this.keyMaterialToBuffer(key);

    // Generate random IV for each encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

    let ivWritten = false;

    const transform = new Transform({
      transform(chunk, encoding, callback) {
        try {
          // GCM rejects a single update() of >= 2 GiB; feed in bounded
          // pieces (the cipher's counter state persists across calls, so
          // output is byte-identical to a single update).
          const out = [];
          for (let off = 0; off < chunk.length; off += GCM_CHUNK_SIZE) {
            out.push(cipher.update(chunk.subarray(off, Math.min(off + GCM_CHUNK_SIZE, chunk.length))));
          }
          if (out.length === 1) {
            const piece = out[0];
            if (!ivWritten) {
              ivWritten = true;
              callback(null, Buffer.concat([iv, piece]));
            } else {
              callback(null, piece);
            }
          } else {
            const encrypted = Buffer.concat(out);
            if (!ivWritten) {
              ivWritten = true;
              callback(null, Buffer.concat([iv, encrypted]));
            } else {
              callback(null, encrypted);
            }
          }
        } catch (error) {
          callback(error);
        }
      },
      flush(callback) {
        try {
          const final = cipher.final();
          const authTag = cipher.getAuthTag();
          // Write auth tag (16 bytes) + final encrypted data
          callback(null, Buffer.concat([authTag, final]));
        } catch (error) {
          callback(error);
        }
      }
    });
    
    // Return transform stream (caller will pipe inputStream to it)
    return transform;
  }
  
  /**
   * Decrypt a stream using a key from key_manager
   * @param {stream.Readable} encryptedStream - Encrypted stream
   * @param {string} keyName - Key name from key_manager
   * @param {number} keyVersion - Optional key version
   * @returns {stream.Transform} Decrypted stream
   */
  async decryptStream(encryptedStream, keyName, projectId, keyVersion = null) {
    const keyBuffer = await this.getKeyBuffer(keyName, projectId);
    
    let iv = null;
    let authTag = null;
    let firstChunk = true;
    
    return new Transform({
      transform(chunk, encoding, callback) {
        if (firstChunk) {
          // Extract IV and auth tag from first chunk
          iv = chunk.slice(0, 16);
          authTag = chunk.slice(16, 32);
          const encrypted = chunk.slice(32);
          
          const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
          decipher.setAuthTag(authTag);
          
          const decrypted = decipher.update(encrypted);
          const final = decipher.final();
          
          firstChunk = false;
          callback(null, Buffer.concat([decrypted, final]));
        } else {
          // Subsequent chunks are just encrypted data
          const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
          decipher.setAuthTag(authTag);
          
          const decrypted = decipher.update(chunk);
          const final = decipher.final();
          
          callback(null, Buffer.concat([decrypted, final]));
        }
      }
    });
  }
  
  /**
   * Encrypt a buffer
   * @param {Buffer} data - Data to encrypt
   * @param {string} keyName - Key name from key_manager
   * @param {string} projectId - Project ID (required for project-scoped keys)
   * @returns {Promise<Buffer>} Encrypted buffer
   */
  async encryptBuffer(data, keyName, projectId) {
    const keyBuffer = await this.getKeyBuffer(keyName, projectId);
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    // GCM rejects a single update() of >= 2 GiB ("data is too long"); feed
    // bounded pieces — output is byte-identical to a single update.
    const parts = [];
    for (let off = 0; off < data.length; off += GCM_CHUNK_SIZE) {
      parts.push(cipher.update(data.subarray(off, Math.min(off + GCM_CHUNK_SIZE, data.length))));
    }
    parts.push(cipher.final());
    const encrypted = Buffer.concat(parts);
    
    const authTag = cipher.getAuthTag();

    // Match decryptBuffer: IV (16) + ciphertext + authTag (16)
    return Buffer.concat([iv, encrypted, authTag]);
  }
  
  /**
   * Decrypt a buffer
   * @param {Buffer} encryptedData - Encrypted data
   * @param {string} keyName - Key name from key_manager
   * @param {string} projectId - Project ID (required for project-scoped keys)
   * @param {number} keyVersion - Optional key version
   * @returns {Promise<Buffer>} Decrypted buffer
   */
  async decryptBuffer(encryptedData, keyName, projectId, keyVersion = null) {
    const keyBuffer = await this.getKeyBuffer(keyName, projectId);
    
    // Format: IV (16 bytes) + encrypted data + authTag (16 bytes) + final encrypted data at end
    // encryptStream writes: IV + encrypted chunks + (authTag + final) in flush
    // So format is: IV (16) + encrypted_data + authTag (16) + final_encrypted
    // But actually, final is also encrypted data, so it's: IV (16) + all_encrypted_data + authTag (16)
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(-16); // Last 16 bytes are authTag
    const encrypted = encryptedData.slice(16, -16); // Everything between IV and authTag is encrypted data
    
    logger.info(`[decryptBuffer] Decrypting: IV length=${iv.length}, encrypted length=${encrypted.length}, authTag length=${authTag.length}, total=${encryptedData.length}`);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    try {
      // GCM rejects a single update() of >= 2 GiB; feed bounded pieces.
      const parts = [];
      for (let off = 0; off < encrypted.length; off += GCM_CHUNK_SIZE) {
        parts.push(decipher.update(encrypted.subarray(off, Math.min(off + GCM_CHUNK_SIZE, encrypted.length))));
      }
      parts.push(decipher.final());
      const decrypted = Buffer.concat(parts);
      logger.info(`[decryptBuffer] Decryption successful: decrypted length=${decrypted.length}`);
      return decrypted;
    } catch (error) {
      logger.error(`[decryptBuffer] Decryption failed:`, error.message);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
  
  /**
   * Generate ETag for object versioning
   * @param {Buffer|string} data - Data to hash
   * @returns {string} ETag (MD5 hash)
   */
  generateETag(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  }
}

module.exports = EncryptionService;
