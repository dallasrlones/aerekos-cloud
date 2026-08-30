const { DatabaseInstance } = require('../models');

class DatabaseRepository {
  /**
   * Create a new database instance record
   * @param {object} databaseData - Database instance data
   * @returns {Promise<object>} Created database instance
   */
  async create(databaseData) {
    return await DatabaseInstance.create(databaseData);
  }

  /**
   * Find database instance by name and projectId
   * @param {string} name - Database name
   * @param {string} projectId - Project ID
   * @returns {Promise<object|null>} Database instance or null
   */
  async findByName(name, projectId) {
    const results = await DatabaseInstance.findAll({ where: { name, project_id: projectId } });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find database instance by ID
   * @param {string} id - Database instance ID
   * @returns {Promise<object|null>} Database instance or null
   */
  async findById(id) {
    const results = await DatabaseInstance.findAll({ where: { id } });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * List all database instances with optional filtering
   * @param {object} filter - Filter options (must include project_id)
   * @returns {Promise<Array>} List of database instances
   */
  async findAll(filter = {}) {
    if (!filter.project_id) {
      throw new Error('project_id is required for database queries');
    }
    // aerekos-record expects { where: { ... } }, not top-level field names
    return await DatabaseInstance.findAll({ where: { ...filter } });
  }

  /**
   * Update database instance
   * @param {string} id - Database instance ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated database instance
   */
  async update(id, updates) {
    await DatabaseInstance.update(id, updates);
    return await this.findById(id);
  }

  /**
   * Delete database instance
   * @param {string} id - Database instance ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    await DatabaseInstance.delete(id);
  }

  /**
   * Find databases by worker ID
   * @param {string} workerId - Worker ID
   * @returns {Promise<Array>} List of database instances on worker
   */
  async findByWorker(workerId) {
    return await DatabaseInstance.findAll({ where: { worker_id: workerId } });
  }

  /**
   * Find databases by type
   * @param {string} type - Database type
   * @returns {Promise<Array>} List of database instances of type
   */
  async findByType(type) {
    return await DatabaseInstance.findAll({ where: { type } });
  }

  /**
   * Find databases by status
   * @param {string} status - Database status
   * @returns {Promise<Array>} List of database instances with status
   */
  async findByStatus(status) {
    return await DatabaseInstance.findAll({ where: { status } });
  }
}

module.exports = DatabaseRepository;
