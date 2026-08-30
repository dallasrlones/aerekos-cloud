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
   * @param {string} [projectName] - Optional project name for project-prefixed naming
   * @returns {string} Container name
   */
  getContainerName(serviceName, projectName = null) {
    if (projectName) {
      return `aerekos-${projectName}-${serviceName}`;
    }
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
      // Use EXACT match, not substring match - prevents finding wrong containers
      const containerInfo = containers.find(c => 
        c.Names && c.Names.some(name => {
          const cleanName = name.replace(/^\//, ''); // Remove leading /
          return cleanName === containerName; // EXACT match only
        })
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
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Container info
   * @throws {Error} If service cannot be started
   */
  async startService(serviceName, config, projectName = null) {
    try {
      // Extract project_name from config if provided
      const actualProjectName = projectName || config.project_name || null;
      const containerName = this.getContainerName(serviceName, actualProjectName);
      
      // Check if container already exists with EXACT name match
      let container = await this.findContainerByName(containerName);
      
      if (container) {
        try {
          // Verify it's the EXACT container name we want (not a substring match)
          const containerInfo = await container.inspect();
          const actualContainerName =
            containerInfo.Name != null
              ? String(containerInfo.Name).replace(/^\//, '')
              : containerName;
          
          if (actualContainerName !== containerName) {
            // Found wrong container (substring match), ignore it and create new one
            console.log(`[ServiceManager] Found container ${actualContainerName} but need ${containerName}, will create new one`);
            container = null;
          } else {
            // Exact match - check if running
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
        } catch (inspectError) {
          // Container might have been removed, clear it from our tracking
          if (inspectError.statusCode === 404 || inspectError.message.includes('No such container')) {
            console.log(`Container ${containerName} no longer exists, will create new one`);
            this.managedServices.delete(serviceName);
            container = null; // Clear container reference so we create a new one
          } else {
            throw inspectError;
          }
        }
      }

      // Create new container from config
      const containerConfig = this.buildContainerConfig(serviceName, config, actualProjectName);
      
      // Check if image exists, if not try to build it
      const imageName = containerConfig.Image;
      try {
        await this.docker.getImage(imageName).inspect();
      } catch (imageError) {
        // Image doesn't exist, try to build it
        console.log(`Image ${imageName} not found, attempting to build...`);
        try {
          await this.buildServiceImage(serviceName, imageName);
        } catch (buildError) {
          console.error(`Failed to build image ${imageName}:`, buildError.message);
          // If build fails, try to pull the image instead
          console.log(`Attempting to pull image ${imageName}...`);
          try {
            await this.pullImage(imageName);
          } catch (pullError) {
            throw new Error(`Image ${imageName} not found and could not be built or pulled: ${pullError.message}`);
          }
        }
      }
      
      // Ensure port mappings are set (default to container port = host port for services)
      if (!containerConfig.HostConfig.PortBindings || Object.keys(containerConfig.HostConfig.PortBindings).length === 0) {
        // Get default port for service
        const defaultPorts = {
          key_manager: 3002,
          storage_manager: 3003,
          db_manager: 3004
        };
        const servicePort = defaultPorts[serviceName] || 3000;
        
        containerConfig.ExposedPorts = { [`${servicePort}/tcp`]: {} };
        containerConfig.HostConfig.PortBindings = {
          [`${servicePort}/tcp`]: [{ HostPort: servicePort.toString() }]
        };
      }
      
      // Connect to worker's network so services can communicate
      if (!containerConfig.NetworkingConfig) {
        // Try to detect worker's network by inspecting worker container
        let networkName = 'aerekos-network'; // Default network name
        
        try {
          // Find worker container to get its network
          const workerContainer = await this.findContainerByName('aerekos-worker');
          if (workerContainer) {
            const workerInfo = await workerContainer.inspect();
            const networks = Object.keys(workerInfo.NetworkSettings?.Networks || {});
            if (networks.length > 0) {
              // Use the first network the worker is on (usually the main network)
              networkName = networks[0];
              console.log(`[ServiceManager] Detected worker network: ${networkName}`);
            }
          }
        } catch (error) {
          // If detection fails, use default network name
          // Docker Compose creates networks with directory prefix, so try common variations
          console.log(`[ServiceManager] Could not detect network, using default: ${networkName}`);
        }
        
        containerConfig.NetworkingConfig = {
          EndpointsConfig: {
            [networkName]: {}
          }
        };
      }
      
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
      console.error(`Original Docker error:`, error.message);
      console.error(`Docker error code:`, error.statusCode || error.code);
      console.error(`Config used:`, JSON.stringify(config, null, 2));
      throw new Error(errorInfo.message);
    }
  }

  /**
   * Stop a service container
   * @param {string} serviceName - Service name
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Container info
   * @throws {Error} If service cannot be stopped
   */
  async stopService(serviceName, projectName = null) {
    try {
      // Try project-prefixed name first, then fallback to non-prefixed
      let containerName = projectName ? this.getContainerName(serviceName, projectName) : this.getContainerName(serviceName);
      let container = await this.findContainerByName(containerName);
      
      // If not found and projectName provided, try non-prefixed (backward compatibility)
      if (!container && projectName) {
        containerName = this.getContainerName(serviceName);
        container = await this.findContainerByName(containerName);
      }
      
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
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Container info
   * @throws {Error} If service cannot be restarted
   */
  async restartService(serviceName, projectName = null) {
    try {
      // Try project-prefixed name first, then fallback to non-prefixed
      let containerName = projectName ? this.getContainerName(serviceName, projectName) : this.getContainerName(serviceName);
      let container = await this.findContainerByName(containerName);
      
      // If not found and projectName provided, try non-prefixed (backward compatibility)
      if (!container && projectName) {
        containerName = this.getContainerName(serviceName);
        container = await this.findContainerByName(containerName);
      }
      
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
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Service status
   */
  async getServiceStatus(serviceName, projectName = null) {
    try {
      // Try project-prefixed name first, then fallback to non-prefixed
      let containerName = projectName ? this.getContainerName(serviceName, projectName) : this.getContainerName(serviceName);
      let container = await this.findContainerByName(containerName);
      
      // If not found and projectName provided, try non-prefixed (backward compatibility)
      if (!container && projectName) {
        containerName = this.getContainerName(serviceName);
        container = await this.findContainerByName(containerName);
      }
      
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
        finishedAt: containerInfo.State.FinishedAt,
        exitCode: containerInfo.State.ExitCode || undefined, // Exit code if container exited
        error: containerInfo.State.Error || undefined, // Error message if container failed
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
   * @returns {Promise<Array>} Array of service statuses with project information
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
        
        // Extract service name and project from container name
        // Pattern: aerekos-{project}-{service} or aerekos-{service}
        const containerName = containerInfo.Names[0].replace(/^\//, '');
        const nameParts = containerName.replace(/^aerekos-/, '').split('-');
        
        let projectName = null;
        let serviceName;
        
        // If name has more than one part after "aerekos-", assume first part is project
        // This is a heuristic - we'll need to check against known project names for accuracy
        if (nameParts.length > 1) {
          // Try to detect project prefix (this is a best-effort approach)
          // In practice, we'll know the project from deployment instructions
          projectName = nameParts[0];
          serviceName = nameParts.slice(1).join('-');
        } else {
          serviceName = nameParts[0];
        }
        
        services.push({
          service: serviceName,
          project: projectName,
          project_id: details.Config?.Labels?.['aerekos.project_id'] || null, // Get project_id from container labels
          id: containerInfo.Id,
          name: containerName,
          status: details.State.Status, // Use details.State.Status (more accurate)
          running: details.State.Running, // Use details.State.Running (correct field)
          image: containerInfo.Image,
          created: containerInfo.Created,
          startedAt: details.State.StartedAt,
          exitCode: details.State.ExitCode || undefined,
          error: details.State.Error || undefined
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
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Updated service info
   * @throws {Error} If service cannot be updated
   */
  async updateService(serviceName, config, projectName = null) {
    try {
      const actualProjectName = projectName || config.project_name || null;
      
      // Stop existing container
      await this.stopService(serviceName, actualProjectName);
      
      // Remove old container
      const containerName = this.getContainerName(serviceName, actualProjectName);
      const container = await this.findContainerByName(containerName);
      if (container) {
        await container.remove();
      }
      
      // Start with new config
      return await this.startService(serviceName, config, actualProjectName);
    } catch (error) {
      console.error(`Error updating service ${serviceName}:`, error);
      throw new Error(`Failed to update service ${serviceName}: ${error.message}`);
    }
  }

  /**
   * Build container configuration from service config
   * @param {string} serviceName - Service name
   * @param {object} config - Service configuration
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {object} Docker container configuration
   */
  buildContainerConfig(serviceName, config, projectName = null) {
    const actualProjectName = projectName || config.project_name || null;
    const containerName = this.getContainerName(serviceName, actualProjectName);
    
    // Use aerekos-{serviceName}:latest as default image name
    const defaultImageName = `aerekos-${serviceName}:latest`;
    const imageName = config.docker_image || config.image || defaultImageName;
    
    const containerConfig = {
      Image: imageName,
      name: containerName,
      Env: config.environment || config.env || [],
      Labels: {
        'aerekos.service': serviceName,
        'aerekos.project': actualProjectName || '',
        'aerekos.project_id': config.project_id || '',
        'aerekos.managed': 'true'
      },
      HostConfig: {
        RestartPolicy: { Name: 'unless-stopped' }, // Auto-restart on failure
        AutoRemove: false // Don't auto-remove containers
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
    const msg = error && error.message != null ? String(error.message) : '';
    const errorInfo = {
      operation,
      service: serviceName,
      error: msg,
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
    } else if (msg.includes('image') || msg.includes('Dockerfile') || msg.includes('not found and could not be built')) {
      errorInfo.type = 'IMAGE_ERROR';
      errorInfo.message = msg.includes('Dockerfile') 
        ? `Dockerfile not found for service ${serviceName || 'unknown'}. Cannot build image.`
        : `Docker image error: ${msg}`;
    } else if (msg.includes('port')) {
      errorInfo.type = 'PORT_ERROR';
      errorInfo.message = 'Port conflict - port may already be in use';
    } else if (msg.includes('memory') || msg.includes('resource') || msg.includes('OOM')) {
      errorInfo.type = 'RESOURCE_ERROR';
      errorInfo.message = 'Insufficient resources (memory, CPU, or disk)';
    } else {
      errorInfo.type = 'UNKNOWN_ERROR';
      errorInfo.message = msg || 'Unknown Docker error';
    }

    return errorInfo;
  }

  /**
   * Build Docker image for a service
   * @param {string} serviceName - Service name
   * @param {string} imageName - Image name/tag
   * @returns {Promise<void>}
   */
  async buildServiceImage(serviceName, imageName) {
    const path = require('path');
    const fs = require('fs');
    const tar = require('tar-fs');
    const { Readable } = require('stream');
    
    // Try to find Dockerfile in service directory
    const servicePath = path.join(__dirname, '..', serviceName);
    const dockerfilePath = path.join(servicePath, 'Dockerfile');
    const dockerfileDevPath = path.join(servicePath, 'Dockerfile.dev');
    
    if (!fs.existsSync(servicePath)) {
      throw new Error(`Service directory not found: ${servicePath}`);
    }
    
    let dockerfile = null;
    if (fs.existsSync(dockerfileDevPath)) {
      dockerfile = 'Dockerfile.dev';
    } else if (fs.existsSync(dockerfilePath)) {
      dockerfile = 'Dockerfile';
    } else {
      throw new Error(`No Dockerfile found for service ${serviceName} in ${servicePath}`);
    }

    console.log(`Building Docker image ${imageName} from ${dockerfile} in ${servicePath}...`);
    
    // Temporary build context: {serviceName}/... (aerekos-record comes from npm during image build)
    const tmpDir = require('os').tmpdir();
    const buildContext = path.join(tmpDir, `docker-build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    fs.mkdirSync(buildContext, { recursive: true });
    
    try {
      const serviceDest = path.join(buildContext, serviceName);
      this.copyDirectory(servicePath, serviceDest);
      
      // Dockerfile at context root (expects COPY {serviceName}/ from worker-oriented Dockerfiles)
      const dockerfileSrc = path.join(servicePath, dockerfile);
      const dockerfileDest = path.join(buildContext, dockerfile);
      fs.copyFileSync(dockerfileSrc, dockerfileDest);
      
      // Create tar stream from build context
      const tarStream = tar.pack(buildContext);
      
      return new Promise((resolve, reject) => {
        this.docker.buildImage(
          tarStream,
          {
            t: imageName,
            dockerfile: dockerfile // Use dockerfile at root of build context
          },
          (err, stream) => {
            if (err) {
              // Cleanup on error
              try {
                fs.rmSync(buildContext, { recursive: true, force: true });
              } catch (cleanupErr) {
                // Ignore cleanup errors
              }
              reject(err);
              return;
            }

            // Monitor build progress
            this.docker.modem.followProgress(stream, (err, output) => {
              // Cleanup build context after build completes
              try {
                fs.rmSync(buildContext, { recursive: true, force: true });
              } catch (cleanupErr) {
                // Ignore cleanup errors
              }
              
              if (err) {
                reject(err);
              } else {
                console.log(`✓ Successfully built image ${imageName}`);
                resolve();
              }
            }, (event) => {
              // Progress callback - log all events to catch errors
              if (event.stream) {
                process.stdout.write(event.stream);
              }
              if (event.error) {
                console.error('Build error:', event.error);
              }
              if (event.errorDetail) {
                console.error('Build error detail:', event.errorDetail);
              }
            });
          }
        );
      });
    } catch (error) {
      // Cleanup on any error before promise
      try {
        fs.rmSync(buildContext, { recursive: true, force: true });
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Copy directory recursively
   * @param {string} src - Source directory
   * @param {string} dest - Destination directory
   */
  copyDirectory(src, dest) {
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(src)) {
      throw new Error(`Source directory does not exist: ${src}`);
    }
    
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip node_modules and other build artifacts
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'coverage') {
        continue;
      }
      
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Pull Docker image
   * @param {string} imageName - Image name/tag
   * @returns {Promise<void>}
   */
  async pullImage(imageName) {
    console.log(`Pulling Docker image ${imageName}...`);
    
    return new Promise((resolve, reject) => {
      this.docker.pull(imageName, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        // Monitor pull progress
        this.docker.modem.followProgress(stream, (err, output) => {
          if (err) {
            reject(err);
          } else {
            console.log(`✓ Successfully pulled image ${imageName}`);
            resolve();
          }
        }, (event) => {
          // Progress callback (optional)
          if (event.status) {
            process.stdout.write(`${event.status}\n`);
          }
        });
      });
    });
  }
}

module.exports = new ServiceManager();

