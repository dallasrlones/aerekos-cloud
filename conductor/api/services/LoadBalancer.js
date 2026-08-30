const { ServiceDeployment, Worker } = require('../models');
const ServiceOrchestrator = require('./ServiceOrchestrator');

/**
 * Load Balancer - Manages load balancing across service instances
 * Implements multiple load balancing algorithms (round-robin, least-connections, weighted)
 */
class LoadBalancer {
  constructor() {
    // In-memory state for load balancing
    // Map<`${projectId}:${serviceId}`, { algorithm, roundRobinIndex, instanceConnections }>
    this.balancerState = new Map();
    
    // Instance health tracking
    // Map<deploymentId, { healthy, lastChecked, consecutiveFailures }>
    this.instanceHealth = new Map();
    
    // Active connections tracking (for least-connections algorithm)
    // Map<deploymentId, connectionCount>
    this.activeConnections = new Map();
  }

  /**
   * Configure load balancer for a service
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @param {object} config - Load balancer configuration
   * @param {string} [config.algorithm] - 'round-robin', 'least-connections', 'weighted', 'ip-hash'
   * @param {number} [config.healthCheckInterval] - Health check interval in ms (default: 30000)
   * @param {number} [config.maxFailures] - Max consecutive failures before marking unhealthy (default: 3)
   * @returns {Promise<object>} Configuration result
   */
  async configureLoadBalancer(projectId, serviceId, config = {}) {
    const key = `${projectId}:${serviceId}`;
    const {
      algorithm = 'round-robin',
      healthCheckInterval = 30000,
      maxFailures = 3
    } = config;

    // Validate algorithm
    const validAlgorithms = ['round-robin', 'least-connections', 'weighted', 'ip-hash'];
    if (!validAlgorithms.includes(algorithm)) {
      throw new Error(`Invalid load balancing algorithm: ${algorithm}. Must be one of: ${validAlgorithms.join(', ')}`);
    }

    // Initialize or update balancer state
    if (!this.balancerState.has(key)) {
      this.balancerState.set(key, {
        algorithm,
        roundRobinIndex: 0,
        instanceConnections: new Map(),
        healthCheckInterval,
        maxFailures
      });
    } else {
      const state = this.balancerState.get(key);
      state.algorithm = algorithm;
      state.healthCheckInterval = healthCheckInterval;
      state.maxFailures = maxFailures;
    }

    // Initialize health tracking for all instances
    await this.refreshInstanceHealth(projectId, serviceId);

    return {
      success: true,
      projectId,
      serviceId,
      algorithm,
      healthCheckInterval,
      maxFailures
    };
  }

  /**
   * Get all healthy service instances
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<Array>} Array of healthy deployment instances
   */
  async getServiceInstances(projectId, serviceId) {
    const deployments = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId,
        status: 'deployed'
      }
    });

    // Filter to only healthy instances
    const healthyInstances = [];
    for (const deployment of deployments) {
      const health = this.instanceHealth.get(deployment.id);
      if (!health || health.healthy) {
        healthyInstances.push(deployment);
      }
    }

    return healthyInstances;
  }

  /**
   * Select instance using load balancing algorithm
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @param {object} [options] - Selection options
   * @param {string} [options.clientIp] - Client IP (for IP-hash algorithm)
   * @returns {Promise<object|null>} Selected deployment instance or null
   */
  async selectInstance(projectId, serviceId, options = {}) {
    const key = `${projectId}:${serviceId}`;
    const state = this.balancerState.get(key);
    
    if (!state) {
      // Auto-configure with defaults if not configured
      await this.configureLoadBalancer(projectId, serviceId);
      return this.selectInstance(projectId, serviceId, options);
    }

    const instances = await this.getServiceInstances(projectId, serviceId);
    
    if (instances.length === 0) {
      return null;
    }

    // If only one instance, return it
    if (instances.length === 1) {
      return instances[0];
    }

    let selectedInstance;

    switch (state.algorithm) {
      case 'round-robin':
        selectedInstance = this.selectRoundRobin(instances, state);
        break;

      case 'least-connections':
        selectedInstance = this.selectLeastConnections(instances);
        break;

      case 'weighted':
        selectedInstance = await this.selectWeighted(instances);
        break;

      case 'ip-hash':
        selectedInstance = this.selectIpHash(instances, options.clientIp);
        break;

      default:
        // Fallback to round-robin
        selectedInstance = this.selectRoundRobin(instances, state);
    }

    // Increment connection count for least-connections tracking
    if (selectedInstance) {
      const currentConnections = this.activeConnections.get(selectedInstance.id) || 0;
      this.activeConnections.set(selectedInstance.id, currentConnections + 1);
    }

    return selectedInstance;
  }

  /**
   * Round-robin selection
   * @param {Array} instances - Service instances
   * @param {object} state - Balancer state
   * @returns {object} Selected instance
   */
  selectRoundRobin(instances, state) {
    const index = state.roundRobinIndex % instances.length;
    state.roundRobinIndex = (state.roundRobinIndex + 1) % instances.length;
    return instances[index];
  }

  /**
   * Least-connections selection
   * @param {Array} instances - Service instances
   * @returns {object} Selected instance
   */
  selectLeastConnections(instances) {
    let minConnections = Infinity;
    let selectedInstance = instances[0];

    for (const instance of instances) {
      const connections = this.activeConnections.get(instance.id) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
      }
    }

    return selectedInstance;
  }

  /**
   * Weighted selection (based on instance capacity/health)
   * @param {Array} instances - Service instances
   * @returns {Promise<object>} Selected instance
   */
  async selectWeighted(instances) {
    // Calculate weights based on worker resources and health
    const weights = [];
    let totalWeight = 0;

    for (const instance of instances) {
      const worker = await Worker.findAll({ where: { id: instance.worker_id } });
      if (worker.length === 0) continue;

      const resources = await ServiceOrchestrator.getAvailableResources(instance.worker_id);
      
      // Weight based on available resources (higher = better)
      // Normalize CPU, RAM, disk to 0-1 scale and average them
      const weight = (resources.utilization.average / 100) || 0.5; // Lower utilization = higher weight
      const normalizedWeight = Math.max(0.1, 1 - weight); // Invert so lower utilization = higher weight
      
      weights.push({
        instance,
        weight: normalizedWeight
      });
      totalWeight += normalizedWeight;
    }

    // Select based on weighted random
    let random = Math.random() * totalWeight;
    for (const { instance, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        return instance;
      }
    }

    // Fallback to first instance
    return instances[0];
  }

  /**
   * IP-hash selection (for session affinity)
   * @param {Array} instances - Service instances
   * @param {string} clientIp - Client IP address
   * @returns {object} Selected instance
   */
  selectIpHash(instances, clientIp) {
    if (!clientIp) {
      // Fallback to round-robin if no IP provided
      return instances[0];
    }

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < clientIp.length; i++) {
      hash = ((hash << 5) - hash) + clientIp.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    const index = Math.abs(hash) % instances.length;
    return instances[index];
  }

  /**
   * Update instance health status
   * @param {string} instanceId - Deployment ID
   * @param {boolean} healthy - Health status
   */
  updateInstanceHealth(instanceId, healthy) {
    const currentHealth = this.instanceHealth.get(instanceId) || {
      healthy: true,
      lastChecked: null,
      consecutiveFailures: 0
    };

    if (healthy) {
      currentHealth.healthy = true;
      currentHealth.consecutiveFailures = 0;
    } else {
      currentHealth.consecutiveFailures += 1;
      const state = this.findStateForInstance(instanceId);
      const maxFailures = state?.maxFailures || 3;
      
      // Mark unhealthy after max failures
      if (currentHealth.consecutiveFailures >= maxFailures) {
        currentHealth.healthy = false;
      }
    }

    currentHealth.lastChecked = new Date();
    this.instanceHealth.set(instanceId, currentHealth);
  }

  /**
   * Find balancer state for an instance
   * @param {string} instanceId - Deployment ID
   * @returns {object|null} Balancer state or null
   */
  findStateForInstance(instanceId) {
    for (const [key, state] of this.balancerState.entries()) {
      // Would need to check if instance belongs to this service
      // For now, return first matching state (simplified)
      return state;
    }
    return null;
  }

  /**
   * Remove instance from load balancer
   * @param {string} instanceId - Deployment ID
   */
  removeInstance(instanceId) {
    this.instanceHealth.delete(instanceId);
    this.activeConnections.delete(instanceId);
  }

  /**
   * Decrement connection count (call when request completes)
   * @param {string} instanceId - Deployment ID
   */
  decrementConnections(instanceId) {
    const currentConnections = this.activeConnections.get(instanceId) || 0;
    if (currentConnections > 0) {
      this.activeConnections.set(instanceId, currentConnections - 1);
    }
  }

  /**
   * Refresh instance health for all instances of a service
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   */
  async refreshInstanceHealth(projectId, serviceId) {
    const deployments = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId,
        status: 'deployed'
      }
    });

    for (const deployment of deployments) {
      // Always mark as healthy by default - actual health checks will mark as unhealthy if needed
      // This ensures newly deployed or restarted services are immediately available
      const existingHealth = this.instanceHealth.get(deployment.id);
      this.instanceHealth.set(deployment.id, {
        healthy: true, // Always reset to healthy - let actual requests determine health
        lastChecked: new Date().toISOString(),
        consecutiveFailures: 0 // Reset failures on refresh
      });
    }
  }

  /**
   * Get load balancer statistics
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object>} Statistics
   */
  async getStatistics(projectId, serviceId) {
    const instances = await this.getServiceInstances(projectId, serviceId);
    const allInstances = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId,
        status: 'deployed'
      }
    });

    const healthyCount = instances.length;
    const unhealthyCount = allInstances.length - healthyCount;

    const connectionStats = [];
    for (const instance of allInstances) {
      const connections = this.activeConnections.get(instance.id) || 0;
      const health = this.instanceHealth.get(instance.id);
      connectionStats.push({
        instanceId: instance.id,
        workerId: instance.worker_id,
        connections,
        healthy: health?.healthy ?? true,
        consecutiveFailures: health?.consecutiveFailures || 0
      });
    }

    const key = `${projectId}:${serviceId}`;
    const state = this.balancerState.get(key);

    return {
      projectId,
      serviceId,
      algorithm: state?.algorithm || 'round-robin',
      totalInstances: allInstances.length,
      healthyInstances: healthyCount,
      unhealthyInstances: unhealthyCount,
      instanceStats: connectionStats
    };
  }
}

module.exports = new LoadBalancer();
