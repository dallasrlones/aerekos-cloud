const ProjectRepository = require('../repos/ProjectRepository');
const WorkerRepository = require('../repos/WorkerRepository');
const { ServiceDeployment, Resource } = require('../models');

/**
 * Service Orchestrator - Intelligent service assignment and auto-scaling
 * Implements AWS/GCP-style bin-packing and resource evaluation
 */
class ServiceOrchestrator {
  constructor(projectRepository, workerRepository) {
    this.projectRepository = projectRepository;
    this.workerRepository = workerRepository;
  }

  /**
   * Find optimal workers for service deployment
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @param {object} options - Deployment options
   * @param {string} [options.placementStrategy] - 'binpack', 'spread', or 'random'
   * @param {number} [options.minInstances] - Minimum number of instances
   * @param {number} [options.maxInstances] - Maximum number of instances
   * @param {object} [options.resourceRequirements] - CPU/RAM/disk requirements for service
   * @returns {Promise<Array>} Array of selected worker IDs
   */
  async findOptimalWorkers(projectId, serviceId, options = {}) {
    const {
      placementStrategy = 'binpack',
      minInstances = 1,
      maxInstances = 1,
      resourceRequirements = {}
    } = options;

    // Check if service is pinned to specific device
    const pinning = await this.checkDevicePinning(projectId, serviceId);
    if (pinning) {
      return [pinning.workerId];
    }

    // Get all workers assigned to this project
    const workers = await this.projectRepository.getWorkers(projectId);
    if (workers.length === 0) {
      throw new Error(`No workers assigned to project ${projectId}`);
    }

    const preferred = this.preferWorkerForService(workers, options.serviceName || serviceId);
    if (preferred) {
      return [preferred.id];
    }

    // Evaluate resources for each worker
    const workerEvaluations = [];
    for (const worker of workers) {
      const evaluation = await this.evaluateWorkerResources(worker.id, resourceRequirements);
      workerEvaluations.push({
        workerId: worker.id,
        worker,
        ...evaluation
      });
    }

    // Filter out workers without sufficient resources
    const suitableWorkers = workerEvaluations.filter(evaluation => evaluation.hasSufficientResources);

    if (suitableWorkers.length === 0) {
      throw new Error(`No workers with sufficient resources for service ${serviceId} in project ${projectId}`);
    }

    // Select workers based on placement strategy
    const selectedWorkers = this.selectWorkersByStrategy(
      suitableWorkers,
      placementStrategy,
      minInstances,
      maxInstances
    );

    return selectedWorkers.map(w => w.workerId);
  }

  /**
   * Evaluate worker's available resources
   * @param {string} workerId - Worker ID
   * @param {object} resourceRequirements - Required resources (CPU, RAM, disk)
   * @returns {Promise<object>} Resource evaluation result
   */
  async evaluateWorkerResources(workerId, resourceRequirements = {}) {
    // Get worker with resources
    const worker = await this.workerRepository.findById(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    // Get current resource usage from existing deployments
    const currentUsage = await this.getCurrentServiceLoad(workerId);

    // Get total resources (from Resource model or worker metadata)
    const resources = await Resource.findAll({ where: { worker_id: workerId } });
    const latestResource = resources.length > 0 ? resources[resources.length - 1] : null;

    const totalCpu = latestResource?.cpu_cores || 0;
    const totalRam = latestResource?.ram_gb || 0;
    const totalDisk = latestResource?.disk_gb || 0;

    // Calculate available resources
    const availableCpu = Math.max(0, totalCpu - currentUsage.cpuUsed);
    const availableRam = Math.max(0, totalRam - currentUsage.ramUsed);
    const availableDisk = Math.max(0, totalDisk - currentUsage.diskUsed);

    // Check if worker has sufficient resources
    const requiredCpu = resourceRequirements.cpu || 0;
    const requiredRam = resourceRequirements.ram || 0;
    const requiredDisk = resourceRequirements.disk || 0;

    const hasSufficientResources = 
      availableCpu >= requiredCpu &&
      availableRam >= requiredRam &&
      availableDisk >= requiredDisk;

    // Calculate utilization percentage
    const cpuUtilization = totalCpu > 0 ? (currentUsage.cpuUsed / totalCpu) * 100 : 0;
    const ramUtilization = totalRam > 0 ? (currentUsage.ramUsed / totalRam) * 100 : 0;
    const diskUtilization = totalDisk > 0 ? (currentUsage.diskUsed / totalDisk) * 100 : 0;

    // Calculate suitability score (lower is better for binpack, higher is better for spread)
    const avgUtilization = (cpuUtilization + ramUtilization + diskUtilization) / 3;
    const suitabilityScore = avgUtilization; // Higher utilization = better for binpack

    return {
      totalCpu,
      totalRam,
      totalDisk,
      availableCpu,
      availableRam,
      availableDisk,
      currentUsage: {
        cpuUsed: currentUsage.cpuUsed,
        ramUsed: currentUsage.ramUsed,
        diskUsed: currentUsage.diskUsed
      },
      utilization: {
        cpu: cpuUtilization,
        ram: ramUtilization,
        disk: diskUtilization,
        average: avgUtilization
      },
      hasSufficientResources,
      suitabilityScore,
      serviceCount: currentUsage.serviceCount
    };
  }

  /**
   * Check if service is pinned to specific device
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object|null>} Pinning info or null
   */
  async checkDevicePinning(projectId, serviceId) {
    // Get all deployments for this service in project
    const deployments = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId
      }
    });

    // Find deployment with pinned_worker_id
    const pinnedDeployment = deployments.find(d => d.pinned_worker_id);

    if (pinnedDeployment && pinnedDeployment.pinned_worker_id) {
      return {
        workerId: pinnedDeployment.pinned_worker_id,
        deploymentId: pinnedDeployment.id
      };
    }

    return null;
  }

  /**
   * Get current service load on worker
   * @param {string} workerId - Worker ID
   * @param {string} [projectId] - Optional project ID to filter by
   * @returns {Promise<object>} Current resource usage
   */
  async getCurrentServiceLoad(workerId, projectId = null) {
    const where = { worker_id: workerId, status: 'deployed' };
    if (projectId) {
      where.project_id = projectId;
    }

    const deployments = await ServiceDeployment.findAll({ where });
    const serviceCount = deployments.length;
    let ramUsed = serviceCount;
    let cpuUsed = serviceCount * 0.5;
    let diskUsed = serviceCount * 2;
    try {
      const { Worker } = require('../models');
      const { parseResources } = require('./deviceRoles');
      const { ramFromResources } = require('./CapacityService');
      const rows = await Worker.findAll({ where: { id: workerId } });
      const res = parseResources(rows[0]?.resources);
      const ram = ramFromResources(res);
      if (ram.total_gb) {
        ramUsed = ram.used_gb;
        cpuUsed = Number((res.cpu && res.cpu.usage) || cpuUsed);
        diskUsed = Number((res.disk && res.disk.used_gb) || diskUsed);
      }
    } catch (_) { /* keep counts */ }
    return {
      serviceCount,
      cpuUsed,
      ramUsed,
      diskUsed
    };
  }

  /**
   * Select workers based on placement strategy
   * @param {Array} workerEvaluations - Array of worker evaluations
   * @param {string} strategy - 'binpack', 'spread', or 'random'
   * @param {number} minInstances - Minimum instances needed
   * @param {number} maxInstances - Maximum instances needed
   * @returns {Array} Selected workers
   */
  selectWorkersByStrategy(workerEvaluations, strategy, minInstances, maxInstances) {
    const numInstances = Math.min(maxInstances, Math.max(minInstances, workerEvaluations.length));

    switch (strategy) {
      case 'binpack':
        // Sort by utilization (highest first) - pack services tightly
        return workerEvaluations
          .sort((a, b) => b.utilization.average - a.utilization.average)
          .slice(0, numInstances);

      case 'spread':
        // Sort by utilization (lowest first) - distribute evenly
        return workerEvaluations
          .sort((a, b) => a.utilization.average - b.utilization.average)
          .slice(0, numInstances);

      case 'random':
        // Random selection
        const shuffled = [...workerEvaluations].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, numInstances);

      default:
        // Default to binpack
        return workerEvaluations
          .sort((a, b) => b.utilization.average - a.utilization.average)
          .slice(0, numInstances);
    }
  }

  /**
   * Calculate optimal load distribution
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object>} Load distribution plan
   */
  async calculateLoadDistribution(projectId, serviceId) {
    const deployments = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId,
        status: 'deployed'
      }
    });

    const workerLoads = {};
    for (const deployment of deployments) {
      const workerId = deployment.worker_id;
      if (!workerLoads[workerId]) {
        workerLoads[workerId] = {
          workerId,
          instanceCount: 0,
          deployments: []
        };
      }
      workerLoads[workerId].instanceCount++;
      workerLoads[workerId].deployments.push(deployment);
    }

    return {
      totalInstances: deployments.length,
      workerDistribution: Object.values(workerLoads),
      isBalanced: this.isLoadBalanced(Object.values(workerLoads))
    };
  }

  /**
   * Check if load is balanced across workers
   * @param {Array} workerLoads - Array of worker load objects
   * @returns {boolean} True if load is balanced
   */
  isLoadBalanced(workerLoads) {
    if (workerLoads.length <= 1) return true;

    const instanceCounts = workerLoads.map(w => w.instanceCount);
    const max = Math.max(...instanceCounts);
    const min = Math.min(...instanceCounts);

    // Consider balanced if difference is <= 1
    return (max - min) <= 1;
  }

  /**
   * Determine if horizontal scaling is needed
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object>} Scaling decision
   */
  async shouldScaleHorizontally(projectId, serviceId) {
    // Get ProjectService record directly (not just the project)
    const { ProjectService } = require('../models');
    const projectServices = await ProjectService.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId
      }
    });
    
    if (projectServices.length === 0) {
      return { shouldScale: false, reason: 'Service not assigned to project' };
    }

    const ps = projectServices[0];
    const scalingPolicy = (ps.scaling_policy && ps.scaling_policy !== '{}') 
      ? JSON.parse(ps.scaling_policy) 
      : {};
    const minInstances = scalingPolicy.min_instances || 1;
    const maxInstances = scalingPolicy.max_instances || 10;
    const targetCpu = scalingPolicy.target_cpu || 70;
    const targetMemory = scalingPolicy.target_memory || 80;

    // Get current deployments
    const deployments = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId,
        status: 'deployed'
      }
    });

    const currentInstances = deployments.length;

    // Check if we need to scale up (would need metrics - for now, check instance count)
    if (currentInstances < minInstances) {
      return {
        shouldScale: true,
        direction: 'up',
        currentInstances,
        targetInstances: minInstances,
        reason: `Below minimum instances (${minInstances})`
      };
    }

    // Check if we need to scale down
    if (currentInstances > maxInstances) {
      return {
        shouldScale: true,
        direction: 'down',
        currentInstances,
        targetInstances: maxInstances,
        reason: `Above maximum instances (${maxInstances})`
      };
    }

    // TODO: Check metrics vs targets (would need actual metrics data)
    // For now, just check instance count bounds

    return {
      shouldScale: false,
      currentInstances,
      reason: 'Within instance bounds'
    };
  }

  preferWorkerForService(workers, serviceName) {
    const name = String(serviceName || '').toLowerCase();
    if (!workers.length) return null;
    const host = (w) => String(w.hostname || '').toLowerCase();
    const gpu = (w) => {
      let res = w.resources;
      if (typeof res === 'string') {
        try { res = JSON.parse(res); } catch { res = {}; }
      }
      return !!(res?.gpu || res?.gpu_count || res?.has_gpu);
    };
    if (name.includes('ai_') || name === 'ai_manager') {
      return workers.find((w) => gpu(w) || host(w).includes('ubuntu') || host(w).includes('orin')) || null;
    }
    const core = ['auth_manager', 'key_manager', 'secrets_manager', 'storage_manager', 'db_manager', 'compute_manager', 'tunnel_manager', 'domain_manager'];
    if (core.includes(name)) {
      return workers.find((w) => host(w).includes('aerekos-server') || host(w).includes('prod')) || null;
    }
    return null;
  }

  /**
   * Get available resources for worker (considering existing deployments)
   * @param {string} workerId - Worker ID
   * @returns {Promise<object>} Available resources
   */
  async getAvailableResources(workerId) {
    const evaluation = await this.evaluateWorkerResources(workerId);
    return {
      cpu: evaluation.availableCpu,
      ram: evaluation.availableRam,
      disk: evaluation.availableDisk,
      utilization: evaluation.utilization
    };
  }
}

module.exports = new ServiceOrchestrator(ProjectRepository, require('../repos/WorkerRepository'));
