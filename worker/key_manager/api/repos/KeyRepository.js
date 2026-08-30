const { Key, KeyAccess } = require('../models');

class KeyRepository {
  /**
   * Create a new key record
   * @param {object} keyData - Key data
   * @returns {Promise<object>} Created key
   */
  async create(keyData) {
    return await Key.create(keyData);
  }

  /**
   * Find key by name (latest active version)
   * @param {string} name - Key name
   * @returns {Promise<object|null>} Key record or null
   */
  async findByName(name) {
    const keys = await Key.findAll({
      where: { name },
      order: 'key_version DESC'
    });
    
    // Return the latest version
    return keys.length > 0 ? keys[0] : null;
  }

  /**
   * Find key by name and version
   * @param {string} name - Key name
   * @param {number} version - Key version
   * @returns {Promise<object|null>} Key record or null
   */
  async findByNameAndVersion(name, version) {
    const keys = await Key.findAll({
      where: { name, key_version: version }
    });
    return keys.length > 0 ? keys[0] : null;
  }

  /**
   * Find all keys with optional filtering
   * @param {object} filter - Filter options
   * @returns {Promise<Array>} Array of keys
   */
  async findAll(filter = {}) {
    const where = {};
    
    if (filter.type) {
      where.type = filter.type;
    }
    
    if (filter.is_active !== undefined) {
      where.is_active = filter.is_active ? 1 : 0;
    }
    
    if (filter.name) {
      where.name = filter.name;
    }
    
    return await Key.findAll({ where });
  }

  /**
   * Update key by ID
   * @param {string} id - Key ID
   * @param {object} keyData - Updated key data
   * @returns {Promise<object>} Updated key
   */
  async update(id, keyData) {
    await Key.update(id, keyData);
    return await Key.find(id);
  }

  /**
   * Delete key by ID
   * @param {string} id - Key ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    await Key.delete(id);
  }

  /**
   * Find all versions of a key by name
   * @param {string} name - Key name
   * @returns {Promise<Array>} Array of key versions
   */
  async findActiveVersions(name) {
    return await Key.findAll({
      where: { name, is_active: 1 },
      order: 'key_version DESC'
    });
  }

  /**
   * Log key access for audit
   * @param {string} keyId - Key ID
   * @param {object} accessData - Access data
   * @returns {Promise<object>} Created access log
   */
  async logAccess(keyId, accessData) {
    return await KeyAccess.create({
      key_id: keyId,
      service_name: accessData.service_name,
      action: accessData.action,
      timestamp: accessData.timestamp || new Date().toISOString(),
      ip_address: accessData.ip_address || 'unknown',
      success: accessData.success ? 1 : 0
    });
  }
}

module.exports = KeyRepository;
