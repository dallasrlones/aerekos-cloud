import api from '../utils/api';

/**
 * Key Manager Service - API calls for key manager service and key management
 */
export const keyManagerService = {
  /**
   * Enable key_manager service
   * @param {string} [workerId] - Optional worker ID
   * @returns {Promise<object>} Deployment result
   */
  async enable(workerId) {
    const response = await api.post('/api/services/key_manager/enable', {
      worker_id: workerId
    });
    return response.data;
  },

  /**
   * Disable key_manager service
   * @returns {Promise<object>} Shutdown result
   */
  async disable() {
    const response = await api.post('/api/services/key_manager/disable');
    return response.data;
  },

  /**
   * Get key_manager service status
   * @returns {Promise<object>} Service status
   */
  async getStatus() {
    const response = await api.get('/api/services/key_manager/status');
    return response.data;
  },

  /**
   * Get key_manager service metrics
   * @returns {Promise<object>} Service metrics
   */
  async getMetrics() {
    const response = await api.get('/api/services/key_manager/metrics');
    return response.data;
  },

  /**
   * Get health status
   * @returns {Promise<object>} Health status
   */
  async getHealth() {
    const response = await api.get('/api/services/key_manager/health');
    return response.data;
  },

  /**
   * List all keys
   * @param {string} projectId - Project ID (required)
   * @param {object} [filters] - Filter options (type, active)
   * @returns {Promise<object>} List of keys
   */
  async getKeys(projectId, filters = {}) {
    const params = { project_id: projectId };
    if (filters.type) params.type = filters.type;
    if (filters.active !== undefined) params.active = filters.active.toString();
    
    const response = await api.get('/api/services/key_manager/api/keys', { params });
    return response.data;
  },

  /**
   * Get key by name
   * @param {string} projectId - Project ID (required)
   * @param {string} name - Key name
   * @param {number} [version] - Optional specific version
   * @returns {Promise<object>} Key details with decrypted key_material
   */
  async getKey(projectId, name, version = null) {
    const path = version 
      ? `/api/services/key_manager/api/keys/${name}/${version}`
      : `/api/services/key_manager/api/keys/${name}`;
    const response = await api.get(path, { params: { project_id: projectId } });
    return response.data;
  },

  /**
   * Get all versions of a key
   * @param {string} projectId - Project ID (required)
   * @param {string} name - Key name
   * @returns {Promise<object>} All versions
   */
  async getKeyVersions(projectId, name) {
    const response = await api.get(`/api/services/key_manager/api/keys/${name}/versions`, {
      params: { project_id: projectId }
    });
    return response.data;
  },

  /**
   * Create a new key
   * @param {string} projectId - Project ID (required)
   * @param {object} keyData - Key data (name, type, algorithm, metadata)
   * @returns {Promise<object>} Created key
   */
  async createKey(projectId, keyData) {
    const response = await api.post('/api/services/key_manager/api/keys', {
      ...keyData,
      project_id: projectId
    });
    return response.data;
  },

  /**
   * Rotate a key
   * @param {string} projectId - Project ID (required)
   * @param {string} name - Key name
   * @returns {Promise<object>} New key version
   */
  async rotateKey(projectId, name) {
    const response = await api.post(`/api/services/key_manager/api/keys/${name}/rotate`, {
      project_id: projectId
    });
    return response.data;
  },

  /**
   * Archive a key
   * @param {string} projectId - Project ID (required)
   * @param {string} name - Key name
   * @returns {Promise<object>} Archived key
   */
  async archiveKey(projectId, name) {
    const response = await api.post(`/api/services/key_manager/api/keys/${name}/archive`, {
      project_id: projectId
    });
    return response.data;
  },

  /**
   * Delete a key (all versions)
   * @param {string} projectId - Project ID (required)
   * @param {string} name - Key name
   * @returns {Promise<void>}
   */
  async deleteKey(projectId, name) {
    await api.delete(`/api/services/key_manager/api/keys/${name}`, {
      params: { project_id: projectId }
    });
  },

  /**
   * Delete a specific key version
   * @param {string} projectId - Project ID (required)
   * @param {string} name - Key name
   * @param {number} version - Key version
   * @returns {Promise<void>}
   */
  async deleteKeyVersion(projectId, name, version) {
    await api.delete(`/api/services/key_manager/api/keys/${name}/${version}`, {
      params: { project_id: projectId }
    });
  },

  /**
   * Replace a key (archive old, use new)
   * @param {string} projectId - Project ID (required)
   * @param {string} oldKeyName - Old key name to archive
   * @param {string} newKeyName - New key name to use
   * @returns {Promise<object>} Replacement result
   */
  async replaceKey(projectId, oldKeyName, newKeyName) {
    // First archive the old key
    await this.archiveKey(projectId, oldKeyName);
    
    // Then update buckets to use new key (via storage_manager)
    const response = await api.post(`/api/services/storage_manager/api/projects/${projectId}/buckets/replace-key`, {
      old_key_name: oldKeyName,
      new_key_name: newKeyName
    });
    
    return response.data;
  }
};
