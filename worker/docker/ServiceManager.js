const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

/**
 * Docker Service Manager - Manages Docker containers for services
 */
class ServiceManager {
  constructor() {
    // Initialize Docker client
    // Use Docker socket if available, otherwise use default Docker API
    this.docker = new Docker({
      socketPath: '/var/run/docker.sock'
    });
    
    // Track managed services
    this.managedServices = new Map(); // serviceName -> containerId
    this.serviceConfigs = new Map(); // serviceName -> config
  }

  /**
   * Get container name for a service
   * @param {string} serviceName - Service name
   * @returns {string} Container name
   */
  getContainerName(serviceName) {
    return `aerekos-${serviceName}`;
  }

  /**
   * Find container by name
   * @param {string} containerName - Container name
   * @returns {Promise<object|null>} Container object or null
   */
  async findContainerByName(containerName) {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const containerInfo = containers.find(c => 
        c.Names && c.Names.some(name => name.includes(containerName))
      );
      
      if (containerInfo) {
        return this.docker.getContainer(containerInfo.Id);
      }
      return null;
    } catch (error) {
      console.error(`Error finding container ${containerName}:`, error);
      return null;
    }
  }

  /**
   * Start a service container
   * @param {string} serviceName - Service name
   * @param {object} config - Service configuration
   * @returns {Promise<object>} Container info
   * @throws {Error} If service cannot be started
   */
  async startService(serviceName, config) {
    try {
      const containerName = this.getContainerName(serviceName);
      
      // Check if container already exists
      let container = await this.findContainerByName(containerName);
      
      if (container) {
        // Check if container is running
        const containerInfo = await container.inspect();
        if (containerInfo.State.Running) {
          throw new Error(`Service ${serviceName} is already running`);
        }
        
        // Start existing container
        await container.start();
        this.managedServices.set(serviceName, containerInfo.Id);
        this.serviceConfigs.set(serviceName, config);
        
        return {
          id: containerInfo.Id,
          name: containerName,
          status: 'started',
          service: serviceName
        };
      }

      // Create new container from config
      const containerConfig = this.buildContainerConfig(serviceName, config);
      
      container = await this.docker.createContainer(containerConfig);
      await container.start();
      
      this.managedServices.set(serviceName, container.id);
      this.serviceConfigs.set(serviceName, config);
      
      return {
        id: container.id,
        name: containerName,
        status: 'created_and_started',
        service: serviceName
      };
    } catch (error) {
      const errorInfo = this.handleDockerError(error, 'start', serviceName);
      console.error(`Error starting service ${serviceName}:`, errorInfo.message);
      throw new Error(errorInfo.message);
    }
  }

  /**
   * Stop a service container
   * @param {string} serviceName - Service name
   * @returns {Promise<object>} Container info
   * @throws {Error} If service cannot be stopped
   */
  async stopService(serviceName) {
    try {
      const containerName = this.getContainerName(serviceName);
      const container = await this.findContainerByName(containerName);
      
      if (!container) {
        throw new Error(`Service ${serviceName} not found`);
      }

      const containerInfo = await container.inspect();
      
      if (!containerInfo.State.Running) {
        throw new Error(`Service ${serviceName} is not running`);
      }

      await container.stop();
      this.managedServices.delete(serviceName);
      
      return {
        id: containerInfo.Id,
        name: containerName,
        status: 'stopped',
        service: serviceName
      };
    } catch (error) {
      const errorInfo = this.handleDockerError(error, 'stop', serviceName);
      console.error(`Error stopping service ${serviceName}:`, errorInfo.message);
      throw new Error(errorInfo.message);
    }
  }

  /**
   * Restart a service container
   * @param {string} serviceName - Service name
   * @returns {Promise<object>} Container info
   * @throws {Error} If service cannot be restarted
   */
  async restartService(serviceName) {
    try {
      const containerName = this.getContainerName(serviceName);
      const container = await this.findContainerByName(containerName);
      
      if (!container) {
        throw new Error(`Service ${serviceName} not found`);
      }

      await container.restart();
      
      const containerInfo = await container.inspect();
      
      return {
        id: containerInfo.Id,
        name: containerName,
        status: 'restarted',
        service: serviceName,
        running: containerInfo.State.Running
      };
    } catch (error) {
      const errorInfo = this.handleDockerError(error, 'restart', serviceName);
      console.error(`Error restarting service ${serviceName}:`, errorInfo.message);
      throw new Error(errorInfo.message);
    }
  }

  /**
   * Get service container status
   * @param {string} serviceName - Service name
   * @returns {Promise<object>} Service status
   */
  async getServiceStatus(serviceName) {
    try {
      const containerName = this.getContainerName(serviceName);
      const container = await this.findContainerByName(containerName);
      
      if (!container) {
        return {
          service: serviceName,
          status: 'not_found',
          running: false
        };
      }

      const containerInfo = await container.inspect();
      
      return {
        service: serviceName,
        id: containerInfo.Id,
        name: containerName,
        status: containerInfo.State.Status,
        running: containerInfo.State.Running,
        restartCount: containerInfo.RestartCount,
        startedAt: containerInfo.State.StartedAt,
        config: this.serviceConfigs.get(serviceName) || null
      };
    } catch (error) {
      console.error(`Error getting service status ${serviceName}:`, error);
      return {
        service: serviceName,
        status: 'error',
        error: error.message,
        running: false
      };
    }
  }

  /**
   * List all managed service containers
   * @returns {Promise<Array>} Array of service statuses
   */
  async listServices() {
    try {
      const services = [];
      
      // Get all containers with our naming prefix
      const containers = await this.docker.listContainers({ all: true });
      const managedContainers = containers.filter(c => 
        c.Names && c.Names.some(name => name.includes('aerekos-'))
      );

      for (const containerInfo of managedContainers) {
        const container = this.docker.getContainer(containerInfo.Id);
        const details = await container.inspect();
        
        // Extract service name from container name
        const serviceName = containerInfo.Names[0]
          .replace(/^\//, '')
          .replace(/^aerekos-/, '');
        
        services.push({
          service: serviceName,
          id: containerInfo.Id,
          name: containerInfo.Names[0],
          status: containerInfo.Status,
          running: containerInfo.State === 'running',
          image: containerInfo.Image,
          created: containerInfo.Created,
          startedAt: details.State.StartedAt
        });
      }

      return services;
    } catch (error) {
      console.error('Error listing services:', error);
      throw new Error(`Failed to list services: ${error.message}`);
    }
  }

  /**
   * Update service configuration
   * @param {string} serviceName - Service name
   * @param {object} config - New configuration
   * @returns {Promise<object>} Updated service info
   * @throws {Error} If service cannot be updated
   */
  async updateService(serviceName, config) {
    try {
      // Stop existing container
      await this.stopService(serviceName);
      
      // Remove old container
      const containerName = this.getContainerName(serviceName);
      const container = await this.findContainerByName(containerName);
      if (container) {
        await container.remove();
      }
      
      // Start with new config
      return await this.startService(serviceName, config);
    } catch (error) {
      console.error(`Error updating service ${serviceName}:`, error);
      throw new Error(`Failed to update service ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Build container configuration from service config
   * @param {string} serviceName - Service name
   * @param {object} config - Service configuration
   * @returns {object} Docker container configuration
   */
  buildContainerConfig(serviceName, config) {
    const containerName = this.getContainerName(serviceName);
    
    const containerConfig = {
      Image: config.docker_image || config.image || `aerekos/${serviceName}:latest`,
      name: containerName,
      Env: config.environment || config.env || [],
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' }
      }
    };

    // Add port mappings
    if (config.ports) {
      containerConfig.ExposedPorts = {};
      containerConfig.HostConfig.PortBindings = {};
      
      for (const [containerPort, hostPort] of Object.entries(config.ports)) {
        const port = containerPort.split('/')[0]; // Remove protocol if present
        containerConfig.ExposedPorts[`${port}/tcp`] = {};
        containerConfig.HostConfig.PortBindings[`${port}/tcp`] = [{
          HostPort: hostPort.toString()
        }];
      }
    }

    // Add volume mounts
    if (config.volumes) {
      containerConfig.HostConfig.Binds = config.volumes.map(volume => {
        if (typeof volume === 'string') {
          return volume;
        }
        return `${volume.source}:${volume.target}`;
      });
    }

    // Add resource limits
    if (config.resources) {
      containerConfig.HostConfig.Memory = config.resources.memory || 0;
      containerConfig.HostConfig.CpuShares = config.resources.cpu_shares || 0;
      containerConfig.HostConfig.CpuQuota = config.resources.cpu_quota || 0;
      containerConfig.HostConfig.CpuPeriod = config.resources.cpu_period || 0;
    }

    // Add network configuration
    if (config.network) {
      containerConfig.NetworkingConfig = {
        EndpointsConfig: {
          [config.network]: {}
        }
      };
    }

    return containerConfig;
  }

  /**
   * Check Docker daemon connectivity
   * @returns {Promise<boolean>} True if Docker is accessible
   */
  async checkDockerConnection() {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      console.error('Docker connection check failed:', error);
      return false;
    }
  }

  /**
   * Handle Docker errors gracefully
   * @param {Error} error - Docker error
   * @param {string} operation - Operation that failed
   * @param {string} serviceName - Service name (if applicable)
   * @returns {object} Error information
   */
  handleDockerError(error, operation, serviceName = null) {
    const errorInfo = {
      operation,
      service: serviceName,
      error: error.message,
      code: error.statusCode || error.code || 'UNKNOWN'
    };

    // Categorize common Docker errors
    if (error.statusCode === 404) {
      errorInfo.type = 'NOT_FOUND';
      errorInfo.message = serviceName 
        ? `Service ${serviceName} not found`
        : 'Container not found';
    } else if (error.statusCode === 409) {
      errorInfo.type = 'CONFLICT';
      errorInfo.message = serviceName
        ? `Service ${serviceName} is already ${operation === 'start' ? 'running' : 'stopped'}`
        : 'Container state conflict';
    } else if (error.statusCode === 500) {
      errorInfo.type = 'SERVER_ERROR';
      errorInfo.message = 'Docker daemon error';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') {
      errorInfo.type = 'CONNECTION_ERROR';
      errorInfo.message = 'Cannot connect to Docker daemon. Is Docker running?';
    } else if (error.message.includes('image')) {
      errorInfo.type = 'IMAGE_ERROR';
      errorInfo.message = 'Docker image error - image may not exist or cannot be pulled';
    } else if (error.message.includes('port')) {
      errorInfo.type = 'PORT_ERROR';
      errorInfo.message = 'Port conflict - port may already be in use';
    } else if (error.message.includes('memory') || error.message.includes('resource')) {
      errorInfo.type = 'RESOURCE_ERROR';
      errorInfo.message = 'Insufficient resources (memory, CPU, or disk)';
    } else {
      errorInfo.type = 'UNKNOWN_ERROR';
      errorInfo.message = error.message || 'Unknown Docker error';
    }

    return errorInfo;
  }
}

module.exports = new ServiceManager();

