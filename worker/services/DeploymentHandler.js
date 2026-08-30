const ServiceManager = require('../docker/ServiceManager');
const ConductorService = require('../api/services/ConductorService');
const usbKeyManager = require('../utils/usbKeyManager');

/**
 * Service Deployment Handler - Processes deployment instructions from conductor
 */
class DeploymentHandler {
  constructor(conductorService) {
    this.conductorService = conductorService;
    this.serviceManager = ServiceManager;
    this.deploymentQueue = [];
    this.isProcessing = false;
    this.processedInstructions = new Set(); // Track processed instructions to prevent duplicates
    this.restartingServices = new Set(); // Track services currently being restarted to prevent duplicate restart attempts
    this.restartTimestamps = new Map(); // Track when restart was initiated to detect stale flags
  }

  /**
   * Handle deployment instruction from conductor
   * @param {object} instruction - Deployment instruction
   * @returns {Promise<object>} Deployment result
   */
  async handleDeploymentInstruction(instruction) {
    try {
      const { action, service, config, project_id, project_name } = instruction;

      if (!action || !service) {
        throw new Error('Invalid deployment instruction: action and service are required');
      }

      // Extract project info from instruction
      const projectName = project_name || (config && config.project_name) || null;

      let result;

      switch (action) {
        case 'deploy':
        case 'start':
          // Ensure project_id is in config for container labels
          if (project_id && config) {
            config.project_id = project_id;
          }
          result = await this.deployService(service, config, projectName);
          break;
        
        case 'stop':
          result = await this.stopService(service, projectName);
          break;
        
        case 'restart':
          result = await this.restartService(service, projectName);
          break;
        
        case 'update':
          result = await this.updateService(service, config, projectName);
          break;
        
        case 'remove':
          result = await this.removeService(service, projectName);
          break;
        
        default:
          throw new Error(`Unknown deployment action: ${action}`);
      }

      // Report status to conductor
      await this.reportDeploymentStatus(service, action, 'success', result);

      return result;
    } catch (error) {
      console.error(`Error handling deployment instruction:`, error);
      
      // Report error to conductor
      await this.reportDeploymentStatus(
        instruction.service,
        instruction.action,
        'failed',
        { error: error.message }
      );

      throw error;
    }
  }

  /**
   * Deploy a service
   * @param {string} serviceName - Service name
   * @param {object} config - Service configuration
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Deployment result
   */
  async deployService(serviceName, config, projectName = null) {
    try {
      console.log(`Deploying service: ${serviceName}${projectName ? ` (project: ${projectName})` : ''}`);

      // Validate config
      if (!config || !config.docker_image) {
        throw new Error(`Service ${serviceName} requires docker_image in config`);
      }

      // For key_manager: Read USB encryption key and add to environment
      if (serviceName === 'key_manager') {
        try {
          console.log(`[DeploymentHandler] Reading encryption key from USB for key_manager...`);
          const encryptionKey = await usbKeyManager.readEncryptionKey();
          
          // Ensure environment array exists (don't overwrite if conductor already set it)
          if (!config.environment) {
            config.environment = [];
          }
          
          // Remove existing MASTER_KEY if present
          config.environment = config.environment.filter(env => !env.startsWith('MASTER_KEY='));
          
          // Add MASTER_KEY from USB
          config.environment.push(`MASTER_KEY=${encryptionKey}`);
          console.log(`[DeploymentHandler] ✓ Encryption key loaded from USB and added to key_manager config`);
        } catch (usbError) {
          console.warn(`[DeploymentHandler] ⚠ Failed to read USB encryption key: ${usbError.message}`);
          console.warn(`[DeploymentHandler] ⚠ key_manager will use MASTER_KEY from environment or dev fallback`);
          // Don't fail deployment - allow fallback to env var or dev mode
        }
        
        // Ensure CONDUCTOR_URL is set (if not already set by conductor)
        if (!config.environment.some(env => env.startsWith('CONDUCTOR_URL='))) {
          const conductorUrl = process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000';
          config.environment.push(`CONDUCTOR_URL=${conductorUrl}`);
          console.log(`[DeploymentHandler] ✓ Added CONDUCTOR_URL=${conductorUrl} to key_manager config`);
        }
        
        // Ensure other required env vars are set
        const requiredEnvVars = {
          'SERVICE_NAME': 'key_manager',
          'PORT': '3002',
          'NODE_ENV': process.env.NODE_ENV || 'development'
        };
        for (const [key, value] of Object.entries(requiredEnvVars)) {
          if (!config.environment.some(env => env.startsWith(`${key}=`))) {
            config.environment.push(`${key}=${value}`);
            console.log(`[DeploymentHandler] ✓ Added ${key}=${value} to key_manager config`);
          }
        }
      }
      
      // Ensure required env vars for db_manager
      if (serviceName === 'db_manager') {
        // Ensure environment array exists
        if (!config.environment) {
          config.environment = [];
        }
        
        // Ensure CONDUCTOR_URL is set (REQUIRED for db_manager)
        if (!config.environment.some(env => env.startsWith('CONDUCTOR_URL='))) {
          const conductorUrl = process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000';
          config.environment.push(`CONDUCTOR_URL=${conductorUrl}`);
          console.log(`[DeploymentHandler] ✓ Added CONDUCTOR_URL=${conductorUrl} to db_manager config`);
        }
        
        // Ensure PROJECT_ID is set (REQUIRED for project-scoped db_manager)
        // If not provided, get the first/default project from conductor
        let projectId = config.project_id;
        if (!projectId) {
          try {
            const axios = require('axios');
            const conductorUrl = process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000';
            const response = await axios.get(`${conductorUrl}/api/projects`, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 5000
            });
            if (response.data.projects && response.data.projects.length > 0) {
              projectId = response.data.projects[0].id;
              console.log(`[DeploymentHandler] Using default project: ${projectId} (${response.data.projects[0].name})`);
            }
          } catch (error) {
            console.warn(`[DeploymentHandler] Could not fetch default project from conductor: ${error.message}`);
          }
        }
        
        if (projectId && !config.environment.some(env => env.startsWith('PROJECT_ID='))) {
          config.environment.push(`PROJECT_ID=${projectId}`);
          console.log(`[DeploymentHandler] ✓ Added PROJECT_ID=${projectId} to db_manager config`);
        } else if (!projectId) {
          console.warn(`[DeploymentHandler] WARNING: PROJECT_ID not available for db_manager. db_manager is project-scoped and requires PROJECT_ID.`);
        }
        
        // Ensure other required env vars are set
        const requiredEnvVars = {
          'SERVICE_NAME': 'db_manager',
          'PORT': '3004',
          'NODE_ENV': process.env.NODE_ENV || 'development'
        };
        for (const [key, value] of Object.entries(requiredEnvVars)) {
          if (!config.environment.some(env => env.startsWith(`${key}=`))) {
            config.environment.push(`${key}=${value}`);
            console.log(`[DeploymentHandler] ✓ Added ${key}=${value} to db_manager config`);
          }
        }
        
        // Ensure Docker socket is mounted (REQUIRED for db_manager to create containers)
        if (!config.volumes) {
          config.volumes = [];
        }
        // Check if Docker socket is already mounted
        const hasDockerSocket = config.volumes.some(vol => {
          const volStr = typeof vol === 'string' ? vol : `${vol.source}:${vol.target}`;
          return volStr.includes('/var/run/docker.sock');
        });
        if (!hasDockerSocket) {
          config.volumes.push('/var/run/docker.sock:/var/run/docker.sock');
          console.log(`[DeploymentHandler] ✓ Added Docker socket mount to db_manager config`);
        }
      }
      
      // Ensure required env vars for storage_manager
      if (serviceName === 'storage_manager') {
        // Ensure environment array exists
        if (!config.environment) {
          config.environment = [];
        }
        
        // Remove MOCK_KEY_MANAGER if set - storage_manager should use real key_manager
        config.environment = config.environment.filter(env => !env.startsWith('MOCK_KEY_MANAGER='));
        console.log(`[DeploymentHandler] ✓ Removed MOCK_KEY_MANAGER from storage_manager config (using real key_manager)`);
        
        // Ensure CONDUCTOR_URL is set (if not already set by conductor)
        if (!config.environment.some(env => env.startsWith('CONDUCTOR_URL='))) {
          const conductorUrl = process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000';
          config.environment.push(`CONDUCTOR_URL=${conductorUrl}`);
          console.log(`[DeploymentHandler] ✓ Added CONDUCTOR_URL=${conductorUrl} to storage_manager config`);
        }
        
        // Ensure PROJECT_ID is set for project-scoped service health checks
        if (config.project_id && !config.environment.some(env => env.startsWith('PROJECT_ID='))) {
          config.environment.push(`PROJECT_ID=${config.project_id}`);
          console.log(`[DeploymentHandler] ✓ Added PROJECT_ID=${config.project_id} to storage_manager config`);
        }
        
        // Ensure other required env vars are set
        const requiredEnvVars = {
          'SERVICE_NAME': 'storage_manager',
          'PORT': '3003',
          'NODE_ENV': process.env.NODE_ENV || 'development'
        };
        for (const [key, value] of Object.entries(requiredEnvVars)) {
          if (!config.environment.some(env => env.startsWith(`${key}=`))) {
            config.environment.push(`${key}=${value}`);
            console.log(`[DeploymentHandler] ✓ Added ${key}=${value} to storage_manager config`);
          }
        }
      }

      // Ensure project_id is in config for container labels
      if (!config.project_id && projectName) {
        // Try to get project_id from WORKER_PROJECTS (if available in global scope)
        // Otherwise, it should be passed in config from conductor
        console.warn(`[DeploymentHandler] project_id not in config for ${serviceName}, container labels may be incomplete`);
      }

      // Check if service-specific docker-compose.yml exists
      // SKIP docker-compose for project-specific deployments - it doesn't support project naming
      // Only use docker-compose for system-wide services (when projectName is null)
      const composeConfig = projectName ? null : await this.loadServiceComposeConfig(serviceName);
      if (composeConfig) {
        // Use docker-compose if available (only for system-wide services, not project-specific)
        return await this.deployWithCompose(serviceName, composeConfig, config, projectName);
      }

      // Deploy using ServiceManager (pass projectName for container naming)
      const result = await this.serviceManager.startService(serviceName, config, projectName);
      
      console.log(`✓ Service ${serviceName} deployed successfully`);
      return {
        service: serviceName,
        action: 'deploy',
        status: 'success',
        container: result
      };
    } catch (error) {
      console.error(`✗ Failed to deploy service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Stop a service
   * @param {string} serviceName - Service name
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Stop result
   */
  async stopService(serviceName, projectName = null) {
    try {
      console.log(`Stopping service: ${serviceName}${projectName ? ` (project: ${projectName})` : ''}`);
      
      const result = await this.serviceManager.stopService(serviceName, projectName);
      
      console.log(`✓ Service ${serviceName} stopped successfully`);
      return {
        service: serviceName,
        action: 'stop',
        status: 'success',
        container: result
      };
    } catch (error) {
      console.error(`✗ Failed to stop service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Restart a service
   * @param {string} serviceName - Service name
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Restart result
   */
  async restartService(serviceName, projectName = null) {
    try {
      console.log(`Restarting service: ${serviceName}${projectName ? ` (project: ${projectName})` : ''}`);
      
      const result = await this.serviceManager.restartService(serviceName, projectName);
      
      console.log(`✓ Service ${serviceName} restarted successfully`);
      return {
        service: serviceName,
        action: 'restart',
        status: 'success',
        container: result
      };
    } catch (error) {
      console.error(`✗ Failed to restart service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Update a service
   * @param {string} serviceName - Service name
   * @param {object} config - New configuration
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Update result
   */
  async updateService(serviceName, config, projectName = null) {
    try {
      console.log(`Updating service: ${serviceName}${projectName ? ` (project: ${projectName})` : ''}`);
      
      const result = await this.serviceManager.updateService(serviceName, config, projectName);
      
      console.log(`✓ Service ${serviceName} updated successfully`);
      return {
        service: serviceName,
        action: 'update',
        status: 'success',
        container: result
      };
    } catch (error) {
      console.error(`✗ Failed to update service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Remove a service
   * @param {string} serviceName - Service name
   * @param {string} [projectName] - Optional project name for project-prefixed container naming
   * @returns {Promise<object>} Remove result
   */
  async removeService(serviceName, projectName = null) {
    try {
      console.log(`Removing service: ${serviceName}${projectName ? ` (project: ${projectName})` : ''}`);
      
      // Stop service first
      try {
        await this.serviceManager.stopService(serviceName, projectName);
      } catch (error) {
        // Ignore if already stopped
      }

      // Find and remove container (try project-prefixed first, then fallback)
      let containerName = projectName ? `aerekos-${projectName}-${serviceName}` : `aerekos-${serviceName}`;
      let container = await this.serviceManager.findContainerByName(containerName);
      
      // If not found and projectName provided, try non-prefixed (backward compatibility)
      if (!container && projectName) {
        containerName = `aerekos-${serviceName}`;
        container = await this.serviceManager.findContainerByName(containerName);
      }
      
      if (container) {
        await container.remove();
      }
      
      console.log(`✓ Service ${serviceName} removed successfully`);
      return {
        service: serviceName,
        action: 'remove',
        status: 'success'
      };
    } catch (error) {
      console.error(`✗ Failed to remove service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Load service-specific docker-compose.yml if it exists
   * @param {string} serviceName - Service name
   * @returns {Promise<object|null>} Compose config or null
   */
  async loadServiceComposeConfig(serviceName) {
    try {
      const path = require('path');
      const fs = require('fs');
      const yaml = require('js-yaml');
      
      const composePath = path.join(__dirname, '..', serviceName, 'docker-compose.yml');
      
      if (fs.existsSync(composePath)) {
        const composeContent = fs.readFileSync(composePath, 'utf8');
        return yaml.load(composeContent);
      }
      
      return null;
    } catch (error) {
      console.error(`Error loading compose config for ${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Deploy service using docker-compose (if available)
   * @param {string} serviceName - Service name
   * @param {object} composeConfig - Docker compose configuration
   * @param {object} config - Service configuration
   * @returns {Promise<object>} Deployment result
   */
  async deployWithCompose(serviceName, composeConfig, config, projectName = null) {
    // NEVER use docker-compose for project-specific deployments - it hardcodes container names
    // Only use ServiceManager which supports project naming
    if (projectName) {
      console.log(`[DeploymentHandler] Skipping docker-compose for project-specific deployment of ${serviceName} (project: ${projectName})`);
      // Fall through to ServiceManager deployment
      const result = await this.serviceManager.startService(serviceName, config, projectName);
      return {
        service: serviceName,
        action: 'deploy',
        status: 'success',
        container: result
      };
    }
    
    // TODO: Implement docker-compose integration for system-wide services only
    // For now, fall back to ServiceManager directly (avoid recursion)
    console.log(`Docker-compose config found for ${serviceName}, but using ServiceManager for now`);
    
    // Validate config
    if (!config || !config.docker_image) {
      throw new Error(`Service ${serviceName} requires docker_image in config`);
    }
    
    // Deploy using ServiceManager directly (not deployService to avoid recursion)
    // Pass projectName so container gets correct name (e.g., aerekos-docunu-dev-storage_manager)
    const result = await this.serviceManager.startService(serviceName, config, projectName);
    
    console.log(`✓ Service ${serviceName} deployed successfully`);
    return {
      service: serviceName,
      action: 'deploy',
      status: 'success',
      container: result
    };
  }

  /**
   * Report deployment status to conductor
   * @param {string} serviceName - Service name
   * @param {string} action - Deployment action
   * @param {string} status - Status (success/failed)
   * @param {object} result - Deployment result
   */
  async reportDeploymentStatus(serviceName, action, status, result) {
    try {
      await this.conductorService.reportServiceStatus(serviceName, status);
    } catch (error) {
      console.error(`Failed to report deployment status to conductor:`, error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Process deployment queue
   */
  async processQueue() {
    if (this.isProcessing || this.deploymentQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.deploymentQueue.length > 0) {
      const instruction = this.deploymentQueue.shift();
      const { service, action } = instruction;
      
      try {
        console.log(`Processing deployment instruction: ${action} for ${service}`);
        const result = await this.handleDeploymentInstruction(instruction);
        console.log(`✓ Successfully processed deployment instruction: ${action} for ${service}`, result);
        
        // Clear restart flag after successful processing
        if (action === 'restart' || action === 'deploy') {
          this.restartingServices.delete(service);
          this.restartTimestamps.delete(service);
          // Clear processed flag after a delay to allow retries if needed
          setTimeout(() => {
            const key = `${service}:${action}`;
            this.processedInstructions.delete(key);
          }, 60000); // Clear after 60 seconds
        }
      } catch (error) {
        console.error(`✗ Error processing deployment instruction ${action} for ${service}:`, error.message);
        console.error('Full error:', error);
        
        // Clear restart flag on error so it can be retried
        if (action === 'restart' || action === 'deploy') {
          this.restartingServices.delete(service);
          this.restartTimestamps.delete(service);
          // Clear processed flag so it can be retried
          const key = `${service}:${action}`;
          this.processedInstructions.delete(key);
        }
        
        // Don't re-throw - log error and continue processing queue
        // This prevents one failed deployment from blocking the entire queue
        console.error(`⚠ Deployment failed for ${service}, continuing with next instruction in queue`);
        // Continue to next instruction instead of throwing
      }
    }

    this.isProcessing = false;
  }

  /**
   * Add deployment instruction to queue
   * @param {object} instruction - Deployment instruction
   */
  queueDeployment(instruction) {
    const { service, action } = instruction;
    
    // For restart/deploy actions, check if already in progress
    if (action === 'restart' || action === 'deploy') {
      // Check if service is already being restarted
      if (this.restartingServices.has(service)) {
        // Check if the restart flag is stale (older than 2 minutes)
        const restartTimestamp = this.restartTimestamps.get(service);
        const now = Date.now();
        const STALE_TIMEOUT = 2 * 60 * 1000; // 2 minutes (reduced from 5 for faster recovery)
        
        // If no timestamp exists, it's likely a stale flag from before restart (shouldn't happen but be safe)
        // If timestamp exists and is stale, clear it
        if (!restartTimestamp || (now - restartTimestamp) > STALE_TIMEOUT) {
          const age = restartTimestamp ? Math.round((now - restartTimestamp) / 1000) : 'unknown';
          console.log(`⚠ Clearing stale restart flag for ${service} (${age}s old)`);
          this.restartingServices.delete(service);
          this.restartTimestamps.delete(service);
          // Also clear processed flag
          const instructionKey = `${service}:${action}`;
          this.processedInstructions.delete(instructionKey);
        } else {
          console.log(`⚠ Skipping ${action} for ${service} - restart already in progress (${Math.round((now - restartTimestamp) / 1000)}s ago)`);
          return;
        }
      }
      
      // For restart/deploy, use service:action as key (without timestamp) to prevent rapid duplicates
      const instructionKey = `${service}:${action}`;
      
      // Skip if we've recently processed this exact instruction (unless stale)
      // But allow if restart flag was cleared (meaning previous attempt failed/stale)
      if (this.processedInstructions.has(instructionKey) && this.restartingServices.has(service)) {
        console.log(`⚠ Skipping duplicate ${action} instruction for ${service} (processed recently and still restarting)`);
        return;
      }
      // If processed but NOT restarting, clear the processed flag (previous attempt completed/failed)
      if (this.processedInstructions.has(instructionKey) && !this.restartingServices.has(service)) {
        console.log(`⚠ Clearing stale processed flag for ${service} (restart flag was cleared)`);
        this.processedInstructions.delete(instructionKey);
      }
      
      // Mark as restarting and record timestamp
      if (action === 'restart' || action === 'deploy') {
        this.restartingServices.add(service);
        this.restartTimestamps.set(service, Date.now());
      }
      
      // Mark as processed (will be cleared after processing)
      this.processedInstructions.add(instructionKey);
    } else {
      // For other actions, use timestamp-based key
      const instructionKey = `${service}:${action}:${instruction.timestamp || Date.now()}`;
      
      if (this.processedInstructions.has(instructionKey)) {
        console.log(`Skipping duplicate deployment instruction: ${action} for ${service}`);
        return;
      }
      
      this.processedInstructions.add(instructionKey);
    }
    
    // Clean up old processed instructions (keep last 100)
    if (this.processedInstructions.size > 100) {
      const firstKey = Array.from(this.processedInstructions)[0];
      this.processedInstructions.delete(firstKey);
    }
    
    this.deploymentQueue.push(instruction);
    this.processQueue();
  }
}

module.exports = DeploymentHandler;

