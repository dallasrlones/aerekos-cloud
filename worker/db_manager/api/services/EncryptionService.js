const axios = require('axios');
const crypto = require('crypto');

class EncryptionService {
  constructor(conductorUrl, serviceToken) {
    this.conductorUrl = conductorUrl;
    this.serviceToken = serviceToken;
    this.defaultKeyName = 'db-manager-encryption-key';
  }
  
  /**
   * Get encryption key from key_manager via conductor
   * @param {string} keyName - Key name (e.g., 'db-manager-encryption-key')
   * @param {string} projectId - Project ID (required for project-scoped services)
   * @returns {Promise<object>} Key object with decrypted key material
   */
  async getEncryptionKey(keyName = this.defaultKeyName, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for encryption key operations');
    }

    if (process.env.MOCK_KEY_MANAGER === 'true') {
      const material =
        process.env.MOCK_KEY_MATERIAL ||
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      return {
        key_name: keyName || this.defaultKeyName,
        key_material: material,
        key_version: 1,
        algorithm: 'AES-256-GCM'
      };
    }

    if (!this.conductorUrl) {
      throw new Error('CONDUCTOR_URL not configured - cannot connect to key_manager');
    }
    
    if (!this.serviceToken) {
      throw new Error('Service token required to authenticate with key_manager');
    }
    
    const url = `${this.conductorUrl}/api/services/key_manager/api/keys/${keyName}?project_id=${projectId}`;
    
    try {
      const response = await axios.get(
        url,
        {
          headers: {
            'Authorization': `Bearer ${this.serviceToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Encryption key '${keyName}' not found in key_manager. Create it first.`);
      }
      throw new Error(`Failed to get encryption key: ${error.message}`);
    }
  }
  
  /**
   * Encrypt connection string or password using key_manager
   * @param {string} data - Data to encrypt
   * @param {string} keyName - Key name from key_manager
   * @param {string} projectId - Project ID (required for project-scoped services)
   * @returns {Promise<string>} Encrypted data (hex string with IV:authTag:encrypted)
   */
  async encryptData(data, keyName = this.defaultKeyName, projectId) {
    const key = await this.getEncryptionKey(keyName, projectId);
    
    // Convert key material to Buffer
    let keyBuffer;
    if (key.key_material.length === 64) {
      keyBuffer = Buffer.from(key.key_material, 'hex');
    } else {
      keyBuffer = Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    // Return IV:authTag:encrypted (all hex)
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  /**
   * Decrypt connection string or password using key_manager
   * @param {string} encryptedData - Encrypted data (IV:authTag:encrypted)
   * @param {string} keyName - Key name from key_manager
   * @param {string} projectId - Project ID (required for project-scoped services)
   * @returns {Promise<string>} Decrypted data
   */
  async decryptData(encryptedData, keyName = this.defaultKeyName, projectId) {
    const key = await this.getEncryptionKey(keyName, projectId);
    
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Convert key material to Buffer
    let keyBuffer;
    if (key.key_material.length === 64) {
      keyBuffer = Buffer.from(key.key_material, 'hex');
    } else {
      keyBuffer = Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
    }
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Ensure encryption key exists in key_manager (create if needed)
   * @param {string} keyName - Key name
   * @param {string} projectId - Project ID (required for project-scoped services)
   * @returns {Promise<void>}
   */
  async ensureEncryptionKey(keyName = this.defaultKeyName, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for encryption key operations');
    }

    if (process.env.MOCK_KEY_MANAGER === 'true') {
      return;
    }
    
    try {
      await this.getEncryptionKey(keyName, projectId);
      console.log(`[db_manager] Encryption key '${keyName}' exists for project ${projectId}`);
    } catch (error) {
      if (error.message.includes('not found')) {
        console.log(`[db_manager] Creating encryption key '${keyName}' for project ${projectId}...`);
        const url = `${this.conductorUrl}/api/services/key_manager/api/keys?project_id=${projectId}`;
        
        try {
          await axios.post(
            url,
            {
              name: keyName,
              type: 'symmetric',
              algorithm: 'AES-256-GCM',
              metadata: {
                description: 'Encryption key for db_manager connection strings and passwords',
                service: 'db_manager'
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${this.serviceToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`[db_manager] Encryption key '${keyName}' created for project ${projectId}`);
        } catch (createError) {
          console.error(`[db_manager] Failed to create encryption key:`, createError.response?.data || createError.message);
          throw new Error(`Failed to create encryption key: ${createError.message}`);
        }
      } else {
        throw error;
      }
    }
  }
}

module.exports = EncryptionService;
