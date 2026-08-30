import api from '../utils/api';

/**
 * Database Manager Service - API calls for db_manager service and database management
 */
export const dbManagerService = {
  /**
   * List all databases
   * @param {object} [filters] - Filter options (type, worker_id, status)
   * @returns {Promise<object>} List of databases
   */
  async getDatabases(filters = {}) {
    const params = {};
    if (filters.type) params.type = filters.type;
    if (filters.worker_id) params.worker_id = filters.worker_id;
    if (filters.status) params.status = filters.status;
    
    const response = await api.get('/api/services/db_manager/api/databases', { params });
    return response.data;
  },

  /**
   * Get database by name
   * @param {string} name - Database name
   * @returns {Promise<object>} Database details
   */
  async getDatabase(name) {
    const response = await api.get(`/api/services/db_manager/api/databases/${name}`);
    return response.data;
  },

  /**
   * Create a new database
   * @param {object} databaseData - Database data (name, type, username, password, port, resource_limits, etc.)
   * @returns {Promise<object>} Created database
   */
  async createDatabase(databaseData) {
    const response = await api.post('/api/services/db_manager/api/databases', databaseData);
    return response.data;
  },

  /**
   * Delete a database
   * @param {string} name - Database name
   * @returns {Promise<void>}
   */
  async deleteDatabase(name) {
    await api.delete(`/api/services/db_manager/api/databases/${name}`);
  },

  /**
   * Get database connection string
   * @param {string} name - Database name
   * @returns {Promise<object>} Connection details
   */
  async getConnectionString(name) {
    const response = await api.get(`/api/services/db_manager/api/databases/${name}/connection`);
    return response.data;
  },

  /**
   * Start a database container
   * @param {string} name - Database name
   * @returns {Promise<object>} Updated database
   */
  async startDatabase(name) {
    const response = await api.post(`/api/services/db_manager/api/databases/${name}/start`);
    return response.data;
  },

  /**
   * Stop a database container
   * @param {string} name - Database name
   * @returns {Promise<object>} Updated database
   */
  async stopDatabase(name) {
    const response = await api.post(`/api/services/db_manager/api/databases/${name}/stop`);
    return response.data;
  },

  /**
   * Restart a database container
   * @param {string} name - Database name
   * @returns {Promise<object>} Updated database
   */
  async restartDatabase(name) {
    const response = await api.post(`/api/services/db_manager/api/databases/${name}/restart`);
    return response.data;
  },

  /**
   * Create a backup of a database
   * @param {string} name - Database name
   * @param {string} [backupType] - e.g. 'full'
   * @returns {Promise<object>} Backup result
   */
  async createBackup(name, backupType = 'full') {
    const response = await api.post(`/api/services/db_manager/api/databases/${name}/backups`, {
      backup_type: backupType,
    });
    return response.data;
  },

  /**
   * Probe a single database's health
   * @param {string} name - Database name
   * @returns {Promise<object>} Per-database health
   */
  async getDatabaseHealth(name) {
    const response = await api.get(`/api/services/db_manager/api/databases/${name}/health`);
    return response.data;
  },

  /**
   * Get service health status
   * @returns {Promise<object>} Health status
   */
  async getHealth() {
    const response = await api.get('/api/services/db_manager/health');
    return response.data;
  }
};

