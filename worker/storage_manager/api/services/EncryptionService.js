const axios = require('axios');
const crypto = require('crypto');
const { Transform } = require('stream');
const logger = require('../utils/logger');

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
      throw new Error('CONDUCTOR_URL not configured - cannot connect to key_manager');
    }

    if (!this.serviceToken) {
      throw new Error('Service token not available - cannot authenticate with key_manager');
    }

    try {
      const response = await axios.get(
        `${this.conductorUrl}/api/services/key_manager/api/keys/${keyName}?project_id=${encodeURIComponent(projectId)}`,
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
   * Encrypt a stream using a key from key_manager
   * Pure streaming - no memory buffering
   * Format: IV (16 bytes) + encrypted data + auth tag (16 bytes) at end
   * @param {stream.Readable} inputStream - Input stream to encrypt (optional, can be piped later)
   * @param {string} keyName - Key name from key_manager
   * @param {string} projectId - Project ID (required for project-scoped keys)
   * @returns {Promise<stream.Transform>} Encrypted stream transform
   */
  async encryptStream(inputStream, keyName, projectId) {
    const key = await this.getEncryptionKey(keyName, projectId);
    
    // Convert key material to Buffer (handle hex or raw string)
    let keyBuffer;
    if (key.key_material.length === 64) {
      // Assume hex encoding
      keyBuffer = Buffer.from(key.key_material, 'hex');
    } else {
      // Use raw string, pad/truncate to 32 bytes
      keyBuffer = Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
    }
    
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    let ivWritten = false;
    let authTag = null;
    
    const transform = new Transform({
      transform(chunk, encoding, callback) {
        try {
          // Write IV on first chunk only
          if (!ivWritten) {
            ivWritten = true;
            const encrypted = cipher.update(chunk);
            // Write IV + first encrypted chunk
            callback(null, Buffer.concat([iv, encrypted]));
          } else {
            const encrypted = cipher.update(chunk);
            callback(null, encrypted);
          }
        } catch (error) {
          callback(error);
        }
      },
      flush(callback) {
        try {
          const final = cipher.final();
          authTag = cipher.getAuthTag();
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
    const key = await this.getEncryptionKey(keyName, projectId);
    
    // Convert key material to Buffer
    let keyBuffer;
    if (key.key_material.length === 64) {
      keyBuffer = Buffer.from(key.key_material, 'hex');
    } else {
      keyBuffer = Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
    }
    
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
    const key = await this.getEncryptionKey(keyName, projectId);
    
    let keyBuffer;
    if (key.key_material.length === 64) {
      keyBuffer = Buffer.from(key.key_material, 'hex');
    } else {
      keyBuffer = Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
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
    const key = await this.getEncryptionKey(keyName, projectId);
    
    let keyBuffer;
    if (key.key_material.length === 64) {
      keyBuffer = Buffer.from(key.key_material, 'hex');
    } else {
      keyBuffer = Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
    }
    
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
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
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
