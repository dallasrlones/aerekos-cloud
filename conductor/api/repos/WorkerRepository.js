const { Worker, Resource } = require('../models');

/**
 * Worker Repository - Database operations for workers
 */
class WorkerRepository {
  /**
   * Find worker by ID
   * @param {string} id
   * @returns {Promise<object|null>} Worker object or null
   */
  async findById(id) {
    const workers = await Worker.findAll({ where: { id } });
    return workers.length > 0 ? workers[0] : null;
  }

  /**
   * Find worker by hostname
   * @param {string} hostname
   * @returns {Promise<object|null>} Worker object or null
   */
  async findByHostname(hostname) {
    const workers = await Worker.findAll({ where: { hostname } });
    return workers.length > 0 ? workers[0] : null;
  }

  /**
   * Find worker by IP address
   * @param {string} ipAddress
   * @returns {Promise<object|null>} Worker object or null
   */
  async findByIpAddress(ipAddress) {
    const workers = await Worker.findAll({ where: { ip_address: ipAddress } });
    return workers.length > 0 ? workers[0] : null;
  }

  /**
   * Create a new worker
   * @param {object} workerData - Worker data (hostname, ip_address, status, resources)
   * @returns {Promise<object>} Created worker
   */
  async create(workerData) {
    return await Worker.create(workerData);
  }

  /**
   * Update worker
   * @param {string} id - Worker ID
   * @param {object} workerData - Updated worker data
   * @returns {Promise<object>} Updated worker
   */
  async update(id, workerData) {
    const worker = await this.findById(id);
    if (!worker) {
      throw new Error('Worker not found');
    }
    return await Worker.update(id, workerData);
  }

  /**
   * Get all workers
   * @returns {Promise<Array>} Array of workers
   */
  async findAll() {
    return await Worker.findAll();
  }

  /**
   * Get workers by status
   * @param {string} status - Worker status (online, offline, degraded)
   * @returns {Promise<Array>} Array of workers
   */
  async findByStatus(status) {
    return await Worker.findAll({ where: { status } });
  }

  /**
   * Update worker's last seen timestamp
   * @param {string} id - Worker ID
   * @returns {Promise<object>} Updated worker
   */
  async updateLastSeen(id) {
    return await this.update(id, {
      last_seen: new Date().toISOString()
    });
  }

  /**
   * Update worker status
   * @param {string} id - Worker ID
   * @param {string} status - New status (online, offline, degraded)
   * @returns {Promise<object>} Updated worker
   */
  async updateStatus(id, status) {
    return await this.update(id, { status });
  }

  /**
   * Update worker resources
   * @param {string} id - Worker ID
   * @param {object} resources - Resource data (JSON string or object)
   * @returns {Promise<object>} Updated worker
   */
  async updateResources(id, resources) {
    const resourcesJson = typeof resources === 'string' ? resources : JSON.stringify(resources);
    return await this.update(id, { resources: resourcesJson });
  }

  /**
   * Create or update resource record for worker
   * @param {string} workerId - Worker ID
   * @param {object} resourceData - Resource data (cpu_cores, ram_gb, disk_gb, network_mbps)
   * @returns {Promise<object>} Created or updated resource
   */
  async upsertResource(workerId, resourceData) {
    // Find existing resource for this worker
    const existingResources = await Resource.findAll({ where: { worker_id: workerId } });
    
    if (existingResources.length > 0) {
      // Update existing resource
      const resource = existingResources[0];
      return await Resource.update(resource.id, resourceData);
    } else {
      // Create new resource
      return await Resource.create({
        ...resourceData,
        worker_id: workerId
      });
    }
  }

  /**
   * Get worker with resources
   * @param {string} id - Worker ID
   * @returns {Promise<object|null>} Worker object with resources or null
   */
  async findByIdWithResources(id) {
    const worker = await this.findById(id);
    if (!worker) {
      return null;
    }

    // Get resources for this worker
    const resources = await Resource.findAll({ where: { worker_id: id } });
    
    // Parse resources JSON if it exists
    let parsedResources = null;
    if (worker.resources) {
      try {
        parsedResources = JSON.parse(worker.resources);
      } catch (e) {
        // If parsing fails, use raw string
        parsedResources = worker.resources;
      }
    }

    return {
      ...worker,
      resources: parsedResources,
      resourceRecords: resources
    };
  }
}

module.exports = new WorkerRepository();

