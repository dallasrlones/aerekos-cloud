const crypto = require('crypto');
const KeyRepository = require('../repos/KeyRepository');

class KeyService {
  constructor(keyRepository, masterKey) {
    this.keyRepository = keyRepository;
    this.masterKey = masterKey; // From environment (set by entrypoint script)
    
    if (!this.masterKey) {
      throw new Error('MASTER_KEY not set - cannot initialize KeyService');
    }
    
    // Ensure master key is proper length (32 bytes = 64 hex chars for AES-256)
    if (this.masterKey.length !== 64) {
      console.warn('[KeyService] Master key length is not 64 hex characters. Deriving 256-bit key...');
      this.masterKey = this.deriveMasterKey(this.masterKey);
    }
  }
  
  /**
   * Derive a 256-bit key from a master key of any length
   * @param {string} masterKey - Master key (any length)
   * @returns {string} 64-character hex string (256 bits)
   */
  deriveMasterKey(masterKey) {
    const salt = 'aerekos-key-manager-salt'; // Fixed salt for key derivation
    const key = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
    return key.toString('hex');
  }
  
  /**
   * Create a new encryption key
   * @param {string} name - Unique key identifier
   * @param {string} type - Key type: 'symmetric', 'asymmetric', 'master'
   * @param {string} algorithm - Algorithm: 'AES-256-GCM', 'RSA-4096', etc.
   * @param {object} metadata - Additional metadata
   * @returns {Promise<object>} Created key
   */
  async createKey(name, type, algorithm, metadata = {}) {
    // Validate inputs
    if (!name || !type || !algorithm) {
      throw new Error('name, type, and algorithm are required');
    }
    
    // Check if key already exists
    const existing = await this.keyRepository.findByName(name);
    if (existing) {
      throw new Error(`Key '${name}' already exists`);
    }
    
    // Generate key material based on type
    let keyMaterial;
    if (type === 'symmetric') {
      // Generate random symmetric key
      keyMaterial = crypto.randomBytes(32).toString('hex'); // 256 bits
    } else if (type === 'asymmetric') {
      // Generate RSA key pair
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: algorithm.includes('4096') ? 4096 : 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      keyMaterial = JSON.stringify({ publicKey, privateKey });
    } else {
      throw new Error(`Unsupported key type: ${type}`);
    }
    
    // Encrypt key material with master key
    const encryptedKey = this.encryptKey(keyMaterial);
    
    // Create key record
    const key = await this.keyRepository.create({
      name,
      type,
      algorithm,
      encrypted_key: encryptedKey,
      key_version: 1,
      is_active: 1,
      metadata: JSON.stringify(metadata)
    });
    
    return this.formatKeyResponse(key);
  }
  
  /**
   * Get key by name (latest version)
   * @param {string} name - Key name
   * @param {number} version - Optional specific version
   * @returns {Promise<object>} Key with decrypted key material
   */
  async getKey(name, version = null) {
    let key;
    
    if (version) {
      key = await this.keyRepository.findByNameAndVersion(name, version);
    } else {
      key = await this.keyRepository.findByName(name);
    }
    
    if (!key) {
      throw new Error(`Key '${name}' not found`);
    }
    
    // Decrypt key material
    const decryptedKeyMaterial = this.decryptKey(key.encrypted_key);
    
    return {
      ...this.formatKeyResponse(key),
      key_material: decryptedKeyMaterial  // Include decrypted material for service use
    };
  }
  
  /**
   * List all keys with optional filtering
   * @param {object} filter - Filter options
   * @returns {Promise<Array>} List of keys
   */
  async listKeys(filter = {}) {
    const keys = await this.keyRepository.findAll(filter);
    return keys.map(key => this.formatKeyResponse(key));
  }
  
  /**
   * Rotate a key (create new version)
   * @param {string} name - Key name
   * @returns {Promise<object>} New key version
   */
  async rotateKey(name) {
    const currentKey = await this.keyRepository.findByName(name);
    if (!currentKey) {
      throw new Error(`Key '${name}' not found`);
    }
    
    // Generate new key material based on type
    let keyMaterial;
    if (currentKey.type === 'symmetric') {
      keyMaterial = crypto.randomBytes(32).toString('hex');
    } else if (currentKey.type === 'asymmetric') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: currentKey.algorithm.includes('4096') ? 4096 : 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      keyMaterial = JSON.stringify({ publicKey, privateKey });
    } else {
      throw new Error(`Cannot rotate key type: ${currentKey.type}`);
    }
    
    const encryptedKey = this.encryptKey(keyMaterial);
    
    // Mark old version as inactive
    await this.keyRepository.update(currentKey.id, { is_active: 0 });
    
    // Create new version
    const newKey = await this.keyRepository.create({
      name,
      type: currentKey.type,
      algorithm: currentKey.algorithm,
      encrypted_key: encryptedKey,
      key_version: currentKey.key_version + 1,
      is_active: 1,
      metadata: currentKey.metadata,
      rotated_at: new Date().toISOString()
    });
    
    return this.formatKeyResponse(newKey);
  }
  
  /**
   * Delete a key (all versions)
   * @param {string} name - Key name
   * @returns {Promise<void>}
   */
  async deleteKey(name) {
    const keys = await this.keyRepository.findAll({ name });
    if (keys.length === 0) {
      throw new Error(`Key '${name}' not found`);
    }
    
    // Delete all versions
    for (const key of keys) {
      await this.keyRepository.delete(key.id);
    }
  }
  
  /**
   * Delete a specific key version
   * @param {string} name - Key name
   * @param {number} version - Key version
   * @returns {Promise<void>}
   */
  async deleteKeyVersion(name, version) {
    const key = await this.keyRepository.findByNameAndVersion(name, version);
    if (!key) {
      throw new Error(`Key '${name}' version ${version} not found`);
    }
    
    await this.keyRepository.delete(key.id);
  }
  
  /**
   * Archive a key (mark as inactive)
   * @param {string} name - Key name
   * @returns {Promise<object>} Archived key
   */
  async archiveKey(name) {
    const key = await this.keyRepository.findByName(name);
    if (!key) {
      throw new Error(`Key '${name}' not found`);
    }
    
    await this.keyRepository.update(key.id, { is_active: 0 });
    return this.formatKeyResponse(await this.keyRepository.findByName(name));
  }
  
  /**
   * Encrypt key material with master key
   * @param {string} keyMaterial - Key material to encrypt
   * @returns {string} Encrypted key (hex string)
   */
  encryptKey(keyMaterial) {
    const iv = crypto.randomBytes(16);
    const masterKeyBuffer = Buffer.from(this.masterKey, 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKeyBuffer, iv);
    
    let encrypted = cipher.update(keyMaterial, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    // Return IV + authTag + encrypted data (all hex)
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  /**
   * Decrypt key material with master key
   * @param {string} encryptedKey - Encrypted key string
   * @returns {string} Decrypted key material
   */
  decryptKey(encryptedKey) {
    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const masterKeyBuffer = Buffer.from(this.masterKey, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKeyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Format key response (without sensitive data)
   * @param {object} key - Key record
   * @returns {object} Formatted key response
   */
  formatKeyResponse(key) {
    return {
      id: key.id,
      name: key.name,
      type: key.type,
      algorithm: key.algorithm,
      key_version: key.key_version,
      is_active: key.is_active === 1,
      created_at: key.created_at,
      updated_at: key.updated_at,
      rotated_at: key.rotated_at,
      metadata: typeof key.metadata === 'string' ? JSON.parse(key.metadata) : (key.metadata || {})
      // Note: key_material is only included in getKey() response, not in list
    };
  }
}

module.exports = KeyService;
