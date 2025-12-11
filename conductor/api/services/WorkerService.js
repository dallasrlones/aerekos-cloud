const WorkerRepository = require('../repos/WorkerRepository');
const TokenService = require('./TokenService');

/**
 * Worker Service - Business logic for worker operations
 */
class WorkerService {
  constructor(workerRepository, tokenService) {
    this.workerRepository = workerRepository;
    this.tokenService = tokenService;
  }

  /**
   * Register a new worker
   * @param {string} token - Registration token
   * @param {string} hostname - Worker hostname
   * @param {string} ipAddress - Worker IP address
   * @param {object} resources - Initial resource information
   * @param {string} [existingWorkerId] - Optional existing worker ID to use
   * @returns {Promise<object>} Registered worker
   * @throws {Error} If token is invalid or registration fails
   */
  async registerWorker(token, hostname, ipAddress, resources = {}, existingWorkerId = null) {
    // Validate registration token
    const isValidToken = await this.tokenService.validateToken(token);
    if (!isValidToken) {
      throw new Error('Invalid registration token');
    }

    // If existingWorkerId is provided, check if it exists and use it
    if (existingWorkerId) {
      try {
        const existingWorker = await this.workerRepository.findById(existingWorkerId);
        if (existingWorker) {
          // Update existing worker
          await this.workerRepository.update(existingWorker.id, {
            hostname,
            ip_address: ipAddress,
            status: 'online',
            last_seen: new Date().toISOString(),
            resources: JSON.stringify(resources)
          });

          // Update resources record
          if (resources.cpu_cores !== undefined || resources.ram_gb !== undefined || 
              resources.disk_gb !== undefined || resources.network_mbps !== undefined) {
            await this.workerRepository.upsertResource(existingWorker.id, {
              cpu_cores: resources.cpu_cores || 0,
              ram_gb: resources.ram_gb || 0,
              disk_gb: resources.disk_gb || 0,
              network_mbps: resources.network_mbps || 0
            });
          }

          return await this.workerRepository.findByIdWithResources(existingWorker.id);
        }
      } catch (error) {
        // Worker ID doesn't exist, continue with normal registration
        console.log(`[WorkerService] Worker ID ${existingWorkerId} not found, creating new worker`);
      }
    }

    // Check if worker already exists (by hostname or IP)
    const existingByHostname = await this.workerRepository.findByHostname(hostname);
    const existingByIp = await this.workerRepository.findByIpAddress(ipAddress);

    // If worker exists, update it (re-registration scenario)
    if (existingByHostname || existingByIp) {
      const existingWorker = existingByHostname || existingByIp;
      
      // Update worker information
      await this.workerRepository.update(existingWorker.id, {
        hostname,
        ip_address: ipAddress,
        status: 'online',
        last_seen: new Date().toISOString(),
        resources: JSON.stringify(resources)
      });

      // Update resources record
      if (resources.cpu_cores !== undefined || resources.ram_gb !== undefined || 
          resources.disk_gb !== undefined || resources.network_mbps !== undefined) {
        await this.workerRepository.upsertResource(existingWorker.id, {
          cpu_cores: resources.cpu_cores || 0,
          ram_gb: resources.ram_gb || 0,
          disk_gb: resources.disk_gb || 0,
          network_mbps: resources.network_mbps || 0
        });
      }

      return await this.workerRepository.findByIdWithResources(existingWorker.id);
    }

    // Create new worker
    const worker = await this.workerRepository.create({
      hostname,
      ip_address: ipAddress,
      status: 'online',
      last_seen: new Date().toISOString(),
      resources: JSON.stringify(resources)
    });

    // Create resource record if resources provided
    if (resources.cpu_cores !== undefined || resources.ram_gb !== undefined || 
        resources.disk_gb !== undefined || resources.network_mbps !== undefined) {
      await this.workerRepository.upsertResource(worker.id, {
        cpu_cores: resources.cpu_cores || 0,
        ram_gb: resources.ram_gb || 0,
        disk_gb: resources.disk_gb || 0,
        network_mbps: resources.network_mbps || 0
      });
    }

    return await this.workerRepository.findByIdWithResources(worker.id);
  }

  /**
   * Send heartbeat from worker
   * @param {string} workerId - Worker ID
   * @returns {Promise<object>} Updated worker
   * @throws {Error} If worker not found
   */
  async sendHeartbeat(workerId) {
    const worker = await this.workerRepository.findById(workerId);
    
    if (!worker) {
      throw new Error('Worker not found');
    }

    // Update last_seen and status
    await this.workerRepository.updateLastSeen(workerId);
    await this.workerRepository.updateStatus(workerId, 'online');

    return await this.workerRepository.findByIdWithResources(workerId);
  }

  /**
   * Update worker resources
   * @param {string} workerId - Worker ID
   * @param {object} resources - Resource data
   * @returns {Promise<object>} Updated worker
   * @throws {Error} If worker not found
   */
  async updateResources(workerId, resources) {
    const worker = await this.workerRepository.findById(workerId);
    
    if (!worker) {
      throw new Error('Worker not found');
    }

    // Update resources JSON string
    await this.workerRepository.updateResources(workerId, resources);

    // Update resource record if specific fields provided
    if (resources.cpu_cores !== undefined || resources.ram_gb !== undefined || 
        resources.disk_gb !== undefined || resources.network_mbps !== undefined) {
      await this.workerRepository.upsertResource(workerId, {
        cpu_cores: resources.cpu_cores,
        ram_gb: resources.ram_gb,
        disk_gb: resources.disk_gb,
        network_mbps: resources.network_mbps
      });
    }

    return await this.workerRepository.findByIdWithResources(workerId);
  }

  /**
   * Get worker by ID
   * @param {string} workerId - Worker ID
   * @returns {Promise<object>} Worker object
   * @throws {Error} If worker not found
   */
  async getWorker(workerId) {
    const worker = await this.workerRepository.findByIdWithResources(workerId);
    
    if (!worker) {
      throw new Error('Worker not found');
    }

    return worker;
  }

  /**
   * Get all workers
   * @returns {Promise<Array>} Array of workers
   */
  async getAllWorkers() {
    const workers = await this.workerRepository.findAll();
    
    // Get resources for each worker
    const workersWithResources = await Promise.all(
      workers.map(async (worker) => {
        return await this.workerRepository.findByIdWithResources(worker.id);
      })
    );

    return workersWithResources;
  }

  /**
   * Get workers by status
   * @param {string} status - Worker status (online, offline, degraded)
   * @returns {Promise<Array>} Array of workers
   */
  async getWorkersByStatus(status) {
    const workers = await this.workerRepository.findByStatus(status);
    
    // Get resources for each worker
    const workersWithResources = await Promise.all(
      workers.map(async (worker) => {
        return await this.workerRepository.findByIdWithResources(worker.id);
      })
    );

    return workersWithResources;
  }

  /**
   * Mark worker as offline (if heartbeat timeout)
   * @param {string} workerId - Worker ID
   * @returns {Promise<object>} Updated worker
   * @throws {Error} If worker not found
   */
  async markWorkerOffline(workerId) {
    const worker = await this.workerRepository.findById(workerId);
    
    if (!worker) {
      throw new Error('Worker not found');
    }

    await this.workerRepository.updateStatus(workerId, 'offline');
    return await this.workerRepository.findByIdWithResources(workerId);
  }
}

module.exports = new WorkerService(WorkerRepository, TokenService);

