const crypto = require('crypto');

/**
 * Encrypt data with master key using AES-256-GCM
 * @param {string} data - Data to encrypt
 * @param {string} masterKey - Master key (hex string)
 * @returns {string} Encrypted data (IV:authTag:encrypted)
 */
function encryptWithMasterKey(data, masterKey) {
  const iv = crypto.randomBytes(16);
  const masterKeyBuffer = Buffer.from(masterKey, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKeyBuffer, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt data with master key
 * @param {string} encryptedData - Encrypted data (IV:authTag:encrypted)
 * @param {string} masterKey - Master key (hex string)
 * @returns {string} Decrypted data
 */
function decryptWithMasterKey(encryptedData, masterKey) {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const masterKeyBuffer = Buffer.from(masterKey, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKeyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate random key material
 * @param {string} algorithm - Algorithm name
 * @returns {string} Hex-encoded key material
 */
function generateKeyMaterial(algorithm) {
  if (algorithm.includes('256')) {
    return crypto.randomBytes(32).toString('hex'); // 256 bits
  } else if (algorithm.includes('128')) {
    return crypto.randomBytes(16).toString('hex'); // 128 bits
  } else {
    return crypto.randomBytes(32).toString('hex'); // Default to 256 bits
  }
}

/**
 * Derive key from master key using PBKDF2
 * @param {string} masterKey - Master key
 * @param {string} salt - Salt
 * @param {string} info - Additional info
 * @returns {string} Derived key (hex)
 */
function deriveKey(masterKey, salt, info) {
  const key = crypto.pbkdf2Sync(masterKey, salt + info, 100000, 32, 'sha256');
  return key.toString('hex');
}

/**
 * Hash key for storage verification
 * @param {string} key - Key to hash
 * @returns {string} Hash (hex)
 */
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

module.exports = {
  encryptWithMasterKey,
  decryptWithMasterKey,
  generateKeyMaterial,
  deriveKey,
  hashKey
};
