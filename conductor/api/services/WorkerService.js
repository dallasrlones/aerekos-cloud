const WorkerRepository = require('../repos/WorkerRepository');
const TokenService = require('./TokenService');
const ProjectRepository = require('../repos/ProjectRepository');

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
   * @param {Array<string>} [projectIds] - Optional array of project IDs to assign worker to
   * @param {object} [extras] - Optional opaque tags (`env`, `capabilities`)
   * @returns {Promise<object>} Registered worker with projects
   * @throws {Error} If token is invalid or registration fails
   */
  async registerWorker(token, hostname, ipAddress, resources = {}, existingWorkerId = null, projectIds = [], extras = {}) {
    // Validate registration token
    const isValidToken = await this.tokenService.validateToken(token);
    if (!isValidToken) {
      throw new Error('Invalid registration token');
    }

    const { env, capabilities } = extras;
    const envVal = env != null && env !== '' ? String(env) : null;
    const capabilitiesVal = capabilities != null
      ? (Array.isArray(capabilities) ? JSON.stringify(capabilities) : String(capabilities))
      : null;
    const tags = {};
    if (envVal != null) tags.env = envVal;
    if (capabilitiesVal != null) tags.capabilities = capabilitiesVal;

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
            resources: JSON.stringify(resources),
            ...tags
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

          // Assign to projects if provided
          if (projectIds && projectIds.length > 0) {
            for (const projectId of projectIds) {
              try {
                await ProjectRepository.assignWorker(projectId, existingWorker.id);
              } catch (error) {
                console.warn(`Failed to assign worker to project ${projectId}:`, error.message);
              }
            }
          }

          const worker = await this.workerRepository.findByIdWithResources(existingWorker.id);
          const projects = await ProjectRepository.getWorkerProjects(existingWorker.id);
          return { ...worker, projects };
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
        resources: JSON.stringify(resources),
        ...tags
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

      // Assign to projects if provided
      if (projectIds && projectIds.length > 0) {
        for (const projectId of projectIds) {
          try {
            await ProjectRepository.assignWorker(projectId, existingWorker.id);
          } catch (error) {
            console.warn(`Failed to assign worker to project ${projectId}:`, error.message);
          }
        }
      }

      const worker = await this.workerRepository.findByIdWithResources(existingWorker.id);
      const projects = await ProjectRepository.getWorkerProjects(existingWorker.id);
      return { ...worker, projects };
    }

    // Create new worker
    const worker = await this.workerRepository.create({
      hostname,
      ip_address: ipAddress,
      status: 'online',
      last_seen: new Date().toISOString(),
      resources: JSON.stringify(resources),
      ...tags
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

    // Assign to projects if provided
    if (projectIds && projectIds.length > 0) {
      for (const projectId of projectIds) {
        try {
          await ProjectRepository.assignWorker(projectId, worker.id);
        } catch (error) {
          console.warn(`Failed to assign worker to project ${projectId}:`, error.message);
        }
      }
    }

    const workerWithResources = await this.workerRepository.findByIdWithResources(worker.id);
    const projects = await ProjectRepository.getWorkerProjects(worker.id);
    try {
      await this.workerRepository.update(worker.id, { vpc_id: extras.vpc_id || 'fleet' });
    } catch (_) { /* column may be missing */ }
    let preauth_key = null;
    if (process.env.HEADSCALE_URL) {
      try {
        const minted = await this.mintMeshKey(worker.id, projectIds[0] || process.env.DEFAULT_PROJECT_ID);
        preauth_key = minted.preauth_key || null;
      } catch (e) {
        console.warn('[WorkerService] Headscale preauth skipped:', e.message);
      }
    }
    return { ...workerWithResources, projects, vpc_id: extras.vpc_id || 'fleet', preauth_key };
  }

  async mintMeshKey(workerId, projectId = null) {
    const worker = await this.workerRepository.findById(workerId);
    if (!worker) throw new Error('Worker not found');
    const ServiceManager = require('./ServiceManager');
    const sm = ServiceManager.getInstance(this.workerRepository);
    const res = await sm.proxyServiceRequest('network_manager', 'POST', '/api/v1/mesh/preauth', {
      tags: ['tag:worker'],
      hostname: worker.hostname,
    }, {}, projectId || process.env.DEFAULT_PROJECT_ID);
    const data = res.data || {};
    const key = data.preauth_key || data.key || null;
    if (key) {
      try {
        let resources = {};
        try { resources = typeof worker.resources === 'object' ? { ...worker.resources } : JSON.parse(worker.resources || '{}'); } catch { resources = {}; }
        resources.mesh_status = 'key_issued';
        await this.workerRepository.update(worker.id, { resources: JSON.stringify(resources) });
      } catch (_) { /* optional */ }
    }
    return {
      worker_id: worker.id,
      hostname: worker.hostname,
      login_server: process.env.HEADSCALE_URL || 'http://192.168.0.141:8080',
      preauth_key: key,
      shown_once: true,
      command: key
        ? `TS_AUTHKEY=${key} TS_EXTRA_ARGS='--login-server=${process.env.HEADSCALE_URL || 'http://192.168.0.141:8080'} --accept-dns=true' docker compose -f worker/docker-compose.tailscale.yml up -d --no-deps`
        : null,
    };
  }

  /**
   * Send heartbeat from worker
   * @param {string} workerId - Worker ID
   * @returns {Promise<object>} Updated worker
   * @throws {Error} If worker not found
   */
  async sendHeartbeat(workerId, extras = {}) {
    const worker = await this.workerRepository.findById(workerId);
    
    if (!worker) {
      throw new Error('Worker not found');
    }

    // Update last_seen and status
    await this.workerRepository.updateLastSeen(workerId);
    await this.workerRepository.updateStatus(workerId, 'online');
    const overlay = extras.overlay_ip || extras.tailscale_ip || extras.resources?.overlay_ip || extras.resources?.tailscale_ip;
    if (overlay) {
      try {
        let resources = {};
        try { resources = typeof worker.resources === 'object' ? { ...worker.resources } : JSON.parse(worker.resources || '{}'); } catch { resources = {}; }
        resources.overlay_ip = overlay;
        await this.workerRepository.update(workerId, { resources: JSON.stringify(resources) });
      } catch (_) { /* optional */ }
    }

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
   * @returns {Promise<object>} Worker object with projects
   * @throws {Error} If worker not found
   */
  async getWorker(workerId) {
    const worker = await this.workerRepository.findByIdWithResources(workerId);
    
    if (!worker) {
      throw new Error('Worker not found');
    }

    const projects = await ProjectRepository.getWorkerProjects(workerId);
    return { ...worker, projects };
  }

  /**
   * Get all projects for a worker
   * @param {string} workerId - Worker ID
   * @returns {Promise<Array>} Array of project objects
   */
  async getWorkerProjects(workerId) {
    return await ProjectRepository.getWorkerProjects(workerId);
  }

  /**
   * Get all workers
   * @returns {Promise<Array>} Array of workers with projects
   */
  async getAllWorkers() {
    const workers = await this.workerRepository.findAll();
    
    // Get resources and projects for each worker
    const workersWithResources = await Promise.all(
      workers.map(async (worker) => {
        const workerWithResources = await this.workerRepository.findByIdWithResources(worker.id);
        const projects = await ProjectRepository.getWorkerProjects(worker.id);
        return { ...workerWithResources, projects };
      })
    );

    return workersWithResources;
  }

  /**
   * Get workers by status
   * @param {string} status - Worker status (online, offline, degraded)
   * @returns {Promise<Array>} Array of workers with projects
   */
  async getWorkersByStatus(status) {
    const workers = await this.workerRepository.findByStatus(status);
    
    // Get resources and projects for each worker
    const workersWithResources = await Promise.all(
      workers.map(async (worker) => {
        const workerWithResources = await this.workerRepository.findByIdWithResources(worker.id);
        const projects = await ProjectRepository.getWorkerProjects(worker.id);
        return { ...workerWithResources, projects };
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
  listVpcs() {
    const extra = String(process.env.HEADSCALE_VPCS || 'lab')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const names = ['fleet', ...extra.filter((n) => n !== 'fleet')];
    return names.map((id) => ({
      id,
      name: id,
      kind: id === 'fleet' ? 'default' : 'named',
      magic_dns: `${id === 'fleet' ? 'conductor' : id}.aerekos.internal`,
    }));
  }

  async moveToVpc(workerId, vpcId) {
    const worker = await this.workerRepository.findById(workerId);
    if (!worker) throw new Error('Worker not found');
    const allowed = this.listVpcs().map((v) => v.id);
    if (!allowed.includes(vpcId)) {
      const e = new Error(`unknown vpc_id: ${vpcId}`);
      e.status = 400;
      throw e;
    }
    await this.workerRepository.update(workerId, { vpc_id: vpcId });
    return this.getWorker(workerId);
  }

  async deregister(workerId) {
    const worker = await this.workerRepository.findById(workerId);
    if (!worker) throw new Error('Worker not found');
    if (process.env.HEADSCALE_URL) {
      try {
        const ServiceManager = require('./ServiceManager');
        const sm = ServiceManager.getInstance(this.workerRepository);
        await sm.proxyServiceRequest('network_manager', 'POST', '/api/v1/mesh/revoke-hostname', {
          hostname: worker.hostname,
        }, {}, process.env.DEFAULT_PROJECT_ID);
      } catch (e) {
        console.warn('[WorkerService] Headscale revoke skipped:', e.message);
      }
    }
    await this.workerRepository.updateStatus(workerId, 'offline');
    return { deregistered: true, id: workerId };
  }

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

