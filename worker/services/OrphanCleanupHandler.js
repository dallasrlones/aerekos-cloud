const ServiceManager = require('../docker/ServiceManager');
const Docker = require('dockerode');

/**
 * Orphan Cleanup Handler - Handles cleanup of orphaned deployments after project deletion
 */
class OrphanCleanupHandler {
  constructor() {
    this.serviceManager = ServiceManager;
    this.docker = new Docker({
      socketPath: '/var/run/docker.sock'
    });
  }

  /**
   * Handle orphan cleanup instruction from conductor
   * @param {object} cleanupData - Cleanup data (orphanedDeploymentIds, projectName)
   * @returns {Promise<object>} Cleanup result
   */
  async handleOrphanCleanup(cleanupData) {
    const { orphanedDeploymentIds, projectName } = cleanupData;
    
    console.log(`[OrphanCleanup] Starting cleanup for ${orphanedDeploymentIds?.length || 0} orphaned deployments`);
    
    if (!orphanedDeploymentIds || orphanedDeploymentIds.length === 0) {
      return {
        success: true,
        cleaned: 0,
        message: 'No orphaned deployments to clean'
      };
    }

    const cleaned = [];
    const errors = [];

    try {
      // Get all running containers
      const allServices = await this.serviceManager.listServices();
      
      // Match containers by project prefix and service name
      // Since we have projectName, we can identify containers with pattern: aerekos-{projectName}-{service}
      for (const service of allServices) {
        // Check if this container matches the orphaned project pattern
        if (projectName && service.project === projectName) {
          try {
            // Stop and remove the container
            const serviceName = service.service;
            console.log(`[OrphanCleanup] Cleaning up orphaned container: ${service.name} (${serviceName})`);
            
            await this.serviceManager.stopService(serviceName, projectName);
            
            // Try to remove container (after stopping)
            try {
              const container = await this.findContainerByName(service.name);
              if (container) {
                // Ensure container is stopped before removing
                try {
                  const containerInfo = await container.inspect();
                  if (containerInfo.State.Running) {
                    await container.stop();
                  }
                } catch (stopError) {
                  // Container might already be stopped
                }
                
                await container.remove();
                console.log(`[OrphanCleanup] Removed container: ${service.name}`);
              }
            } catch (removeError) {
              // Container might already be removed, that's okay
              console.log(`[OrphanCleanup] Container ${service.name} already removed or not found`);
            }
            
            cleaned.push({
              deploymentId: service.id,
              containerName: service.name,
              serviceName: serviceName
            });
          } catch (error) {
            console.error(`[OrphanCleanup] Error cleaning up container ${service.name}:`, error.message);
            errors.push({
              containerName: service.name,
              error: error.message
            });
          }
        }
      }

      console.log(`[OrphanCleanup] Cleanup complete: ${cleaned.length} containers cleaned, ${errors.length} errors`);

      return {
        success: errors.length === 0,
        cleaned: cleaned.length,
        cleanedContainers: cleaned,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error(`[OrphanCleanup] Error during cleanup:`, error);
      return {
        success: false,
        cleaned: cleaned.length,
        cleanedContainers: cleaned,
        error: error.message
      };
    }
  }

  /**
   * Find container by name (helper method)
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
}

module.exports = new OrphanCleanupHandler();
