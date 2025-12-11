const ServiceManager = require('../docker/ServiceManager');
const ConductorService = require('../api/services/ConductorService');

/**
 * Service Deployment Handler - Processes deployment instructions from conductor
 */
class DeploymentHandler {
  constructor(conductorService) {
    this.conductorService = conductorService;
    this.serviceManager = ServiceManager;
    this.deploymentQueue = [];
    this.isProcessing = false;
  }

  /**
   * Handle deployment instruction from conductor
   * @param {object} instruction - Deployment instruction
   * @returns {Promise<object>} Deployment result
   */
  async handleDeploymentInstruction(instruction) {
    try {
      const { action, service, config } = instruction;

      if (!action || !service) {
        throw new Error('Invalid deployment instruction: action and service are required');
      }

      let result;

      switch (action) {
        case 'deploy':
        case 'start':
          result = await this.deployService(service, config);
          break;
        
        case 'stop':
          result = await this.stopService(service);
          break;
        
        case 'restart':
          result = await this.restartService(service);
          break;
        
        case 'update':
          result = await this.updateService(service, config);
          break;
        
        case 'remove':
          result = await this.removeService(service);
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
   * @returns {Promise<object>} Deployment result
   */
  async deployService(serviceName, config) {
    try {
      console.log(`Deploying service: ${serviceName}`);

      // Validate config
      if (!config || !config.docker_image) {
        throw new Error(`Service ${serviceName} requires docker_image in config`);
      }

      // Check if service-specific docker-compose.yml exists
      const composeConfig = await this.loadServiceComposeConfig(serviceName);
      if (composeConfig) {
        // Use docker-compose if available
        return await this.deployWithCompose(serviceName, composeConfig, config);
      }

      // Deploy using ServiceManager
      const result = await this.serviceManager.startService(serviceName, config);
      
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
   * @returns {Promise<object>} Stop result
   */
  async stopService(serviceName) {
    try {
      console.log(`Stopping service: ${serviceName}`);
      
      const result = await this.serviceManager.stopService(serviceName);
      
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
   * @returns {Promise<object>} Restart result
   */
  async restartService(serviceName) {
    try {
      console.log(`Restarting service: ${serviceName}`);
      
      const result = await this.serviceManager.restartService(serviceName);
      
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
   * @returns {Promise<object>} Update result
   */
  async updateService(serviceName, config) {
    try {
      console.log(`Updating service: ${serviceName}`);
      
      const result = await this.serviceManager.updateService(serviceName, config);
      
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
   * @returns {Promise<object>} Remove result
   */
  async removeService(serviceName) {
    try {
      console.log(`Removing service: ${serviceName}`);
      
      // Stop service first
      try {
        await this.serviceManager.stopService(serviceName);
      } catch (error) {
        // Ignore if already stopped
      }

      // Find and remove container
      const containerName = `aerekos-${serviceName}`;
      const container = await this.serviceManager.findContainerByName(containerName);
      
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
  async deployWithCompose(serviceName, composeConfig, config) {
    // TODO: Implement docker-compose integration
    // For now, fall back to ServiceManager
    console.log(`Docker-compose config found for ${serviceName}, but using ServiceManager for now`);
    return await this.deployService(serviceName, config);
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
      try {
        await this.handleDeploymentInstruction(instruction);
      } catch (error) {
        console.error('Error processing deployment instruction:', error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Add deployment instruction to queue
   * @param {object} instruction - Deployment instruction
   */
  queueDeployment(instruction) {
    this.deploymentQueue.push(instruction);
    this.processQueue();
  }
}

module.exports = DeploymentHandler;

