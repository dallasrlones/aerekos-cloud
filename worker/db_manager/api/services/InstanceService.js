const Docker = require('dockerode');
const logger = require('../utils/logger');

/**
 * InstanceService - Manages Docker containers for database instances
 * Uses dockerode directly (db_manager runs on worker with Docker socket access)
 */
class InstanceService {
  constructor() {
    // Initialize Docker client with socket path
    this.docker = new Docker({
      socketPath: '/var/run/docker.sock'
    });
  }

  /**
   * Get container name for a database
   * @param {string} databaseName - Database name
   * @param {string} [projectName] - Optional project name for project-prefixed naming
   * @returns {string} Container name
   */
  getContainerName(databaseName, projectName = null) {
    if (projectName) {
      return `aerekos-${projectName}-db-${databaseName}`;
    }
    return `aerekos-db-${databaseName}`;
  }

  /**
   * Get volume name for a database
   * @param {string} databaseName - Database name
   * @param {string} [projectName] - Optional project name for project-prefixed naming
   * @returns {string} Volume name
   */
  getVolumeName(databaseName, projectName = null) {
    if (projectName) {
      return `aerekos-${projectName}-db-${databaseName}-data`;
    }
    return `aerekos-db-${databaseName}-data`;
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
      logger.error(`Error finding container ${containerName}:`, error);
      return null;
    }
  }

  /**
   * Get host IP address for connection strings
   * Uses WORKER_IP env var if available, otherwise detects from network interfaces
   * For Docker Desktop, uses host.docker.internal IP
   * @returns {string} Host IP address
   */
  getHostIp() {
    // Priority 1: Use WORKER_IP environment variable (set by worker entrypoint)
    if (process.env.WORKER_IP) {
      logger.info(`[InstanceService] Using WORKER_IP: ${process.env.WORKER_IP}`);
      return process.env.WORKER_IP;
    }

    // Priority 2: For Docker Desktop, try to resolve host.docker.internal
    try {
      const { execSync } = require('child_process');
      // Try to resolve host.docker.internal using getent (works in Docker)
      const hostIp = execSync('getent hosts host.docker.internal 2>/dev/null | awk \'{print $1}\' || echo ""', { encoding: 'utf8' }).trim();
      if (hostIp && hostIp !== '127.0.0.1' && hostIp !== '') {
        logger.info(`[InstanceService] Using host.docker.internal IP: ${hostIp}`);
        return hostIp;
      }
    } catch (error) {
      // Ignore errors, try next method
    }

    // Priority 3: Try to get gateway IP (for Docker Desktop, gateway is often the host)
    try {
      const { execSync } = require('child_process');
      const gateway = execSync('ip route | grep default | awk \'{print $3}\' 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
      if (gateway && !gateway.startsWith('172.17.') && !gateway.startsWith('172.19.')) {
        // Gateway is not a Docker network IP, likely the host IP
        logger.info(`[InstanceService] Using gateway as host IP: ${gateway}`);
        return gateway;
      }
    } catch (error) {
      // Ignore errors, try next method
    }

    // Priority 4: Detect from network interfaces (skip Docker networks)
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        // Skip Docker interfaces
        if (name.startsWith('docker') || name.startsWith('br-') || name.startsWith('veth')) {
          continue;
        }
        for (const iface of interfaces[name]) {
          // Skip Docker network IPs (172.17.x.x, 172.19.x.x, 172.18.x.x)
          if (iface.family === 'IPv4' && !iface.internal && 
              !iface.address.startsWith('172.17.') && 
              !iface.address.startsWith('172.18.') && 
              !iface.address.startsWith('172.19.')) {
            logger.info(`[InstanceService] Detected host IP: ${iface.address} from interface ${name}`);
            return iface.address;
          }
        }
      }
    } catch (error) {
      logger.warn(`[InstanceService] Error detecting host IP: ${error.message}`);
    }

    // Fallback: use localhost (will work for same-host connections)
    logger.warn('[InstanceService] Could not detect host IP, using localhost');
    return 'localhost';
  }

  /**
   * Find available port starting from startPort
   * @param {number} startPort - Starting port number
   * @returns {Promise<number>} Available port
   */
  async findAvailablePort(startPort) {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const usedPorts = new Set();
      
      // Collect all used ports from running containers
      for (const containerInfo of containers) {
        if (containerInfo.Ports) {
          containerInfo.Ports.forEach(port => {
            if (port.PublicPort) {
              usedPorts.add(port.PublicPort);
            }
          });
        }
      }
      
      // Find first available port starting from startPort
      let port = startPort;
      while (usedPorts.has(port) && port < 65535) {
        port++;
      }
      
      if (port >= 65535) {
        throw new Error('No available ports found');
      }
      
      return port;
    } catch (error) {
      logger.error('Error finding available port:', error);
      throw new Error(`Failed to find available port: ${error.message}`);
    }
  }

  /**
   * Detect worker network name
   * @returns {Promise<string>} Network name
   */
  async detectWorkerNetwork() {
    try {
      // Try to find worker container to get its network
      const workerContainer = await this.findContainerByName('aerekos-worker');
      if (workerContainer) {
        const workerInfo = await workerContainer.inspect();
        const networks = Object.keys(workerInfo.NetworkSettings?.Networks || {});
        if (networks.length > 0) {
          logger.info(`[InstanceService] Detected worker network: ${networks[0]}`);
          return networks[0];
        }
      }
    } catch (error) {
      logger.warn(`[InstanceService] Could not detect network: ${error.message}`);
    }
    
    // Default network name (Docker Compose creates networks with directory prefix)
    return 'aerekos-network';
  }

  /**
   * Create a database container instance
   * @param {object} config - Container configuration
   * @param {string} config.name - Database name
   * @param {string} config.type - Database type (postgresql, mongodb, etc.)
   * @param {object} config.containerConfig - Docker container configuration (from database handler)
   * @param {function} config.waitForReady - Function to wait for database readiness
   * @returns {Promise<object>} Container info
   */
  async createInstance(config) {
    const { name, type, containerConfig, waitForReady, projectName, storage } = config;
    const containerName = this.getContainerName(name, projectName);
    
    // Determine storage configuration
    const storageType = storage?.type || 'volume';
    const storageLocation = storage?.location;
    const storageDriver = storage?.driver;
    const storageDriverOptions = storage?.driver_options || {};
    
    let volumeName = null;
    let bindMountPath = null;
    
    if (storageType === 'bind') {
      // Bind mount: use provided host path
      if (!storageLocation) {
        throw new Error('storage.location is required when storage.type is "bind"');
      }
      bindMountPath = storageLocation;
      logger.info(`[InstanceService] Using bind mount: ${bindMountPath}`);
    } else {
      // Docker volume: use custom name if provided, otherwise generate
      volumeName = storageLocation || this.getVolumeName(name, projectName);
      logger.info(`[InstanceService] Using Docker volume: ${volumeName}`);
    }

    try {
      // Check if container already exists
      let container = await this.findContainerByName(containerName);
      if (container) {
        const containerInfo = await container.inspect();
        if (containerInfo.State.Running) {
          throw new Error(`Database container '${name}' is already running`);
        }
        // Remove existing stopped container
        await container.remove({ force: true });
      }

      // Create volume for data persistence (only for volume type)
      if (storageType === 'volume') {
        try {
          const volumeConfig = {
            Name: volumeName
          };
          
          // Add driver if specified
          if (storageDriver) {
            volumeConfig.Driver = storageDriver;
          }
          
          // Add driver options if specified
          if (Object.keys(storageDriverOptions).length > 0) {
            volumeConfig.DriverOpts = storageDriverOptions;
          }
          
          await this.docker.createVolume(volumeConfig);
          logger.info(`[InstanceService] Created volume: ${volumeName}${storageDriver ? ` (driver: ${storageDriver})` : ''}`);
        } catch (error) {
          if (error.statusCode === 409) {
            // Volume already exists, that's okay
            logger.info(`[InstanceService] Volume ${volumeName} already exists`);
          } else {
            throw error;
          }
        }
      }

      // Detect worker network
      const networkName = await this.detectWorkerNetwork();
      
      // Ensure network exists
      try {
        await this.docker.getNetwork(networkName).inspect();
      } catch (error) {
        if (error.statusCode === 404) {
          // Create network if it doesn't exist
          await this.docker.createNetwork({
            Name: networkName,
            Driver: 'bridge'
          });
          logger.info(`[InstanceService] Created network: ${networkName}`);
        } else {
          throw error;
        }
      }

      // Add network configuration to container config
      if (!containerConfig.NetworkingConfig) {
        containerConfig.NetworkingConfig = {
          EndpointsConfig: {
            [networkName]: {}
          }
        };
      }

      // Set container name
      containerConfig.name = containerName;

      // Configure storage mounts based on storage type
      if (!containerConfig.HostConfig.Binds) {
        containerConfig.HostConfig.Binds = [];
      }
      
      // Get data paths from container config volumes
      const dataPaths = containerConfig.Volumes ? Object.keys(containerConfig.Volumes) : ['/data'];
      
      if (storageType === 'bind') {
        // Bind mount: mount host path to container path(s)
        // For databases with multiple volumes (like Neo4j), mount to first path
        const primaryDataPath = dataPaths[0];
        containerConfig.HostConfig.Binds.push(`${bindMountPath}:${primaryDataPath}`);
        logger.info(`[InstanceService] Configured bind mount: ${bindMountPath} -> ${primaryDataPath}`);
        
        // For Neo4j, also mount logs if needed
        if (dataPaths.length > 1 && type === 'neo4j') {
          // Neo4j logs can use a subdirectory or separate bind mount
          // For simplicity, we'll use the same parent directory
          const logsPath = dataPaths[1];
          const logsMountPath = bindMountPath.replace(/\/data$/, '/logs') || `${bindMountPath}-logs`;
          containerConfig.HostConfig.Binds.push(`${logsMountPath}:${logsPath}`);
          logger.info(`[InstanceService] Configured bind mount for logs: ${logsMountPath} -> ${logsPath}`);
        }
      } else {
        // Docker volume: mount volume to container path(s)
        for (const dataPath of dataPaths) {
          // For Neo4j with multiple volumes, create separate volumes
          if (dataPaths.length > 1 && type === 'neo4j') {
            const volumeSuffix = dataPath === '/data' ? 'data' : 'logs';
            const volName = `${volumeName}-${volumeSuffix}`;
            containerConfig.HostConfig.Binds.push(`${volName}:${dataPath}`);
            logger.info(`[InstanceService] Configured volume mount: ${volName} -> ${dataPath}`);
          } else {
            containerConfig.HostConfig.Binds.push(`${volumeName}:${dataPath}`);
            logger.info(`[InstanceService] Configured volume mount: ${volumeName} -> ${dataPath}`);
          }
        }
      }

      // Create container
      container = await this.docker.createContainer(containerConfig);
      logger.info(`[InstanceService] Created container: ${containerName}`);

      // Start container
      await container.start();
      logger.info(`[InstanceService] Started container: ${containerName}`);

      // Wait for database to be ready (if waitForReady function provided)
      if (waitForReady && typeof waitForReady === 'function') {
        logger.info(`[InstanceService] Waiting for ${type} database to be ready...`);
        await waitForReady(container);
        logger.info(`[InstanceService] Database ${name} is ready`);
      }

      // Get container info
      const containerInfo = await container.inspect();

      // Get host IP for connection strings (use actual network IP, not localhost)
      const hostIp = this.getHostIp();

      return {
        id: container.id,
        name: containerName,
        status: 'running',
        port: this.extractPort(containerInfo),
        host: hostIp
      };
    } catch (error) {
      logger.error(`[InstanceService] Error creating instance ${name}:`, error);
      throw this.handleDockerError(error, 'create', name);
    }
  }

  /**
   * Extract port from container info
   * Returns the first exposed port (primary port)
   * For databases with multiple ports (like Neo4j), returns the BOLT/primary port
   * @param {object} containerInfo - Container inspect result
   * @returns {number|null} Port number
   */
  extractPort(containerInfo) {
    try {
      const portBindings = containerInfo.NetworkSettings?.Ports;
      if (portBindings) {
        // Get all ports and return the first one (primary port)
        // For Neo4j, this will be the BOLT port (7687) which is typically listed first
        for (const [containerPort, bindings] of Object.entries(portBindings)) {
          if (bindings && bindings.length > 0 && bindings[0].HostPort) {
            return parseInt(bindings[0].HostPort);
          }
        }
      }
      return null;
    } catch (error) {
      logger.warn('Error extracting port:', error);
      return null;
    }
  }

  /**
   * Start a database container
   * @param {string} databaseName - Database name
   * @param {string} [projectName] - Optional project name for project-prefixed naming
   * @returns {Promise<object>} Container info
   */
  async startInstance(databaseName, projectName = null) {
    const containerName = this.getContainerName(databaseName, projectName);
    
    try {
      const container = await this.findContainerByName(containerName);
      if (!container) {
        throw new Error(`Database container '${databaseName}' not found`);
      }

      const containerInfo = await container.inspect();
      if (containerInfo.State.Running) {
        return {
          name: containerName,
          status: 'running',
          message: 'Container is already running'
        };
      }

      await container.start();
      logger.info(`[InstanceService] Started container: ${containerName}`);

      return {
        name: containerName,
        status: 'running'
      };
    } catch (error) {
      logger.error(`[InstanceService] Error starting instance ${databaseName}:`, error);
      throw this.handleDockerError(error, 'start', databaseName);
    }
  }

  /**
   * Stop a database container
   * @param {string} databaseName - Database name
   * @param {string} [projectName] - Optional project name for project-prefixed naming
   * @returns {Promise<object>} Container info
   */
  async stopInstance(databaseName, projectName = null) {
    const containerName = this.getContainerName(databaseName, projectName);
    
    try {
      const container = await this.findContainerByName(containerName);
      if (!container) {
        throw new Error(`Database container '${databaseName}' not found`);
      }

      const containerInfo = await container.inspect();
      if (!containerInfo.State.Running) {
        return {
          name: containerName,
          status: 'stopped',
          message: 'Container is already stopped'
        };
      }

      await container.stop();
      logger.info(`[InstanceService] Stopped container: ${containerName}`);

      return {
        name: containerName,
        status: 'stopped'
      };
    } catch (error) {
      logger.error(`[InstanceService] Error stopping instance ${databaseName}:`, error);
      throw this.handleDockerError(error, 'stop', databaseName);
    }
  }

  /**
   * Restart a database container
   * @param {string} databaseName - Database name
   * @param {string} [projectName] - Optional project name for project-prefixed naming
   * @returns {Promise<object>} Container info
   */
  async restartInstance(databaseName, projectName = null) {
    const containerName = this.getContainerName(databaseName, projectName);
    
    try {
      const container = await this.findContainerByName(containerName);
      if (!container) {
        throw new Error(`Database container '${databaseName}' not found`);
      }

      await container.restart();
      logger.info(`[InstanceService] Restarted container: ${containerName}`);

      const containerInfo = await container.inspect();

      return {
        name: containerName,
        status: containerInfo.State.Running ? 'running' : 'stopped'
      };
    } catch (error) {
      logger.error(`[InstanceService] Error restarting instance ${databaseName}:`, error);
      throw this.handleDockerError(error, 'restart', databaseName);
    }
  }

  /**
   * Delete a database container and its volume
   * @param {string} databaseName - Database name
   * @returns {Promise<void>}
   */
  async deleteInstance(databaseName, projectName = null) {
    const containerName = this.getContainerName(databaseName, projectName);
    const volumeName = this.getVolumeName(databaseName, projectName);
    
    try {
      const container = await this.findContainerByName(containerName);
      
      if (container) {
        // Stop container if running
        try {
          const containerInfo = await container.inspect();
          if (containerInfo.State.Running) {
            await container.stop();
            logger.info(`[InstanceService] Stopped container: ${containerName}`);
          }
        } catch (error) {
          // Container might already be stopped, continue
        }

        // Remove container
        await container.remove({ force: true });
        logger.info(`[InstanceService] Removed container: ${containerName}`);
      }

      // Remove volume
      try {
        const volume = this.docker.getVolume(volumeName);
        await volume.remove({ force: true });
        logger.info(`[InstanceService] Removed volume: ${volumeName}`);
      } catch (error) {
        if (error.statusCode !== 404) {
          logger.warn(`[InstanceService] Could not remove volume ${volumeName}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`[InstanceService] Error deleting instance ${databaseName}:`, error);
      throw this.handleDockerError(error, 'delete', databaseName);
    }
  }

  /**
   * Get container status
   * @param {string} databaseName - Database name
   * @returns {Promise<object>} Container status
   */
  async getInstanceStatus(databaseName, projectName = null) {
    const containerName = this.getContainerName(databaseName, projectName);
    
    try {
      const container = await this.findContainerByName(containerName);
      if (!container) {
        return {
          name: containerName,
          status: 'not_found',
          running: false
        };
      }

      const containerInfo = await container.inspect();
      
      return {
        name: containerName,
        id: containerInfo.Id,
        status: containerInfo.State.Status,
        running: containerInfo.State.Running,
        restartCount: containerInfo.RestartCount,
        startedAt: containerInfo.State.StartedAt,
        finishedAt: containerInfo.State.FinishedAt,
        exitCode: containerInfo.State.ExitCode,
        error: containerInfo.State.Error
      };
    } catch (error) {
      logger.error(`[InstanceService] Error getting status for ${databaseName}:`, error);
      return {
        name: containerName,
        status: 'error',
        error: error.message,
        running: false
      };
    }
  }

  /**
   * Handle Docker errors gracefully
   * @param {Error} error - Docker error
   * @param {string} operation - Operation that failed
   * @param {string} databaseName - Database name (if applicable)
   * @returns {Error} Formatted error
   */
  handleDockerError(error, operation, databaseName = null) {
    let message = error.message;

    if (error.statusCode === 404) {
      message = databaseName 
        ? `Database container '${databaseName}' not found`
        : 'Container not found';
    } else if (error.statusCode === 409) {
      message = databaseName
        ? `Database container '${databaseName}' already exists`
        : 'Container state conflict';
    } else if (error.statusCode === 500) {
      message = 'Docker daemon error';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') {
      message = 'Cannot connect to Docker daemon. Is Docker running?';
    } else if (error.message.includes('port')) {
      message = 'Port conflict - port may already be in use';
    } else if (error.message.includes('memory') || error.message.includes('resource')) {
      message = 'Insufficient resources (memory, CPU, or disk)';
    }

    const formattedError = new Error(message);
    formattedError.originalError = error;
    formattedError.operation = operation;
    formattedError.databaseName = databaseName;
    
    return formattedError;
  }
}

module.exports = InstanceService;

