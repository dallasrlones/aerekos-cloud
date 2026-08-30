const ProjectRepository = require('../repos/ProjectRepository');
const WorkerSocketService = require('./WorkerSocketService');
const ServiceManager = require('./ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');
const { Service, ProjectService: ProjectServiceModel } = require('../models');

/**
 * Project Service - Business logic for project operations
 */
class ProjectService {
  constructor(projectRepository) {
    this.projectRepository = projectRepository;
  }

  /**
   * Create a new project
   * @param {object} projectData - Project data (name, description, enabled, config)
   * @returns {Promise<object>} Created project with isFirst flag
   * @throws {Error} If validation fails or project already exists
   */
  async createProject(projectData) {
    // Validate required fields
    if (!projectData.name || projectData.name.trim().length < 3) {
      throw new Error('Project name is required and must be at least 3 characters');
    }

    // Check if project with same name already exists
    const existing = await this.projectRepository.findByName(projectData.name.trim());
    if (existing) {
      throw new Error(`Project with name "${projectData.name}" already exists`);
    }

    // Check if this is the first project
    const allProjects = await this.projectRepository.findAll();
    const isFirstProject = allProjects.length === 0;

    // Create project
    const project = await this.projectRepository.create({
      name: projectData.name.trim(),
      description: projectData.description || '',
      enabled: projectData.enabled !== undefined ? (projectData.enabled ? 1 : 0) : 1,
      config: projectData.config ? JSON.stringify(projectData.config) : JSON.stringify({})
    });

    try {
      const { attachPlatformServicesToProject } = require('./PlatformServiceSync');
      await attachPlatformServicesToProject(project.id);
    } catch (err) {
      console.warn('[ProjectService] platform services:', err.message);
    }

    try {
      const EnvironmentService = require('./EnvironmentService');
      await EnvironmentService.ensureForProject(project.id, project.name);
    } catch (err) {
      console.warn('[ProjectService] environments:', err.message);
    }

    return {
      ...project,
      isFirst: isFirstProject
    };
  }

  /**
   * Update project
   * @param {string} id - Project ID
   * @param {object} projectData - Updated project data
   * @returns {Promise<object>} Updated project
   * @throws {Error} If project not found or validation fails
   */
  async updateProject(id, projectData) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new Error('Project not found');
    }

    // Validate name if provided
    if (projectData.name !== undefined) {
      if (!projectData.name || projectData.name.trim().length < 3) {
        throw new Error('Project name must be at least 3 characters');
      }

      // Check if another project with same name exists
      const existing = await this.projectRepository.findByName(projectData.name.trim());
      if (existing && existing.id !== id) {
        throw new Error(`Project with name "${projectData.name}" already exists`);
      }
    }

    const updateData = {};
    if (projectData.name !== undefined) updateData.name = projectData.name.trim();
    if (projectData.description !== undefined) updateData.description = projectData.description;
    if (projectData.enabled !== undefined) updateData.enabled = projectData.enabled ? 1 : 0;
    if (projectData.config !== undefined) updateData.config = JSON.stringify(projectData.config);

    return await this.projectRepository.update(id, updateData);
  }

  /**
   * Delete project (transactional)
   * Flags deployments as orphaned, detaches from project, and sends cleanup instructions to workers
   * @param {string} id - Project ID
   * @returns {Promise<object>} Deletion result with cleanup job IDs
   * @throws {Error} If project not found or deletion fails
   */
  async deleteProject(id) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get all deployments for this project
    const deployments = await this.projectRepository.getProjectDeployments(id);
    
    // Get all workers assigned to this project (for cleanup instructions)
    const workers = await this.projectRepository.getWorkers(id);

    try {
      // Step 1: Flag deployments as orphaned and detach from project
      const orphanedDeploymentIds = await this.projectRepository.flagDeploymentsAsOrphaned(id);

      // Step 2: Delete ProjectWorker associations
      await this.projectRepository.deleteAllWorkerAssociations(id);

      // Step 3: Delete ProjectService associations
      await this.projectRepository.deleteAllServiceAssociations(id);

      // Step 4: Delete Project record
      await this.projectRepository.delete(id);

      // Step 5: Send cleanup instructions to all workers
      const cleanupJobIds = [];
      for (const worker of workers) {
        try {
          // Send cleanup instruction via WebSocket
          const sent = WorkerSocketService.sendOrphanCleanupInstruction(worker.id, {
            orphanedDeploymentIds,
            projectName: project.name
          });

          if (sent) {
            cleanupJobIds.push({
              workerId: worker.id,
              workerHostname: worker.hostname,
              method: 'websocket'
            });
          } else {
            // Queue for HTTP polling if WebSocket not available
            cleanupJobIds.push({
              workerId: worker.id,
              workerHostname: worker.hostname,
              method: 'queued',
              note: 'WebSocket not available, queued for HTTP polling'
            });
          }
        } catch (error) {
          console.error(`Failed to send cleanup instruction to worker ${worker.id}:`, error);
          cleanupJobIds.push({
            workerId: worker.id,
            workerHostname: worker.hostname,
            method: 'failed',
            error: error.message
          });
        }
      }

      return {
        success: true,
        projectId: id,
        projectName: project.name,
        orphanedDeploymentCount: orphanedDeploymentIds.length,
        orphanedDeploymentIds,
        cleanupJobIds
      };
    } catch (error) {
      // If any step fails, throw error (transaction rollback would happen here if supported)
      console.error(`Error deleting project ${id}:`, error);
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Get project with workers and services
   * @param {string} id - Project ID
   * @returns {Promise<object|null>} Project object with workers and services, or null
   */
  async getProject(id) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      return null;
    }

    const workers = await this.projectRepository.getWorkers(id);
    const services = await this.projectRepository.getServices(id);
    const deployments = await this.projectRepository.getProjectDeployments(id);

    // Parse config JSON if it exists
    let parsedConfig = {};
    if (project.config) {
      try {
        parsedConfig = JSON.parse(project.config);
      } catch (e) {
        // If parsing fails, use empty object
        parsedConfig = {};
      }
    }

    return {
      ...project,
      config: parsedConfig,
      workers,
      services,
      deployments,
      workerCount: workers.length,
      serviceCount: services.length,
      deploymentCount: deployments.length
    };
  }

  /**
   * List all projects
   * @param {object} options - Optional filters (where, orderBy, etc.)
   * @returns {Promise<Array>} Array of projects
   */
  async listProjects(options = {}) {
    const projects = await this.projectRepository.findAll(options);
    
    // Enrich with counts
    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        const workers = await this.projectRepository.getWorkers(project.id);
        const services = await this.projectRepository.getServices(project.id);
        const deployments = await this.projectRepository.getProjectDeployments(project.id);

        // Parse config JSON if it exists
        let parsedConfig = {};
        if (project.config) {
          try {
            parsedConfig = JSON.parse(project.config);
          } catch (e) {
            parsedConfig = {};
          }
        }

        return {
          ...project,
          config: parsedConfig,
          workerCount: workers.length,
          serviceCount: services.length,
          deploymentCount: deployments.length
        };
      })
    );

    return enrichedProjects;
  }

  /**
   * Assign worker to project
   * @param {string} projectId - Project ID
   * @param {string} workerId - Worker ID
   * @returns {Promise<object>} Assignment result
   * @throws {Error} If project or worker not found
   */
  async assignWorkerToProject(projectId, workerId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Note: Worker existence will be checked by ProjectRepository
    await this.projectRepository.assignWorker(projectId, workerId);

    return {
      success: true,
      projectId,
      workerId
    };
  }

  /**
   * Unassign worker from project
   * @param {string} projectId - Project ID
   * @param {string} workerId - Worker ID
   * @returns {Promise<object>} Unassignment result
   * @throws {Error} If project not found
   */
  async unassignWorkerFromProject(projectId, workerId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    await this.projectRepository.unassignWorker(projectId, workerId);

    return {
      success: true,
      projectId,
      workerId
    };
  }

  /**
   * Assign service to project
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object>} Assignment result
   * @throws {Error} If project or service not found
   */
  async assignServiceToProject(projectId, serviceId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Note: Service existence will be checked by ProjectRepository
    await this.projectRepository.assignService(projectId, serviceId);

    return {
      success: true,
      projectId,
      serviceId
    };
  }

  /**
   * Unassign service from project
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object>} Unassignment result
   * @throws {Error} If project not found
   */
  async unassignServiceFromProject(projectId, serviceId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    await this.projectRepository.unassignService(projectId, serviceId);

    return {
      success: true,
      projectId,
      serviceId
    };
  }

  /**
   * Enable service for project (triggers auto-deployment)
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object>} Enable result with deployment info
   */
  async enableServiceForProject(projectId, serviceId) {
    // Verify project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Verify service exists
    const services = await Service.findAll({ where: { id: serviceId } });
    if (services.length === 0) {
      throw new Error('Service not found');
    }
    const service = services[0];

    // Get or create ProjectService association
    let projectService = await ProjectServiceModel.findAll({
      where: { project_id: projectId, service_id: serviceId }
    });

    if (projectService.length === 0) {
      // Create association if it doesn't exist
      projectService = [await ProjectServiceModel.create({
        project_id: projectId,
        service_id: serviceId,
        enabled: 1,
        config: '{}',
        scaling_policy: '{}'
      })];
    } else {
      // Update to enabled
      await ProjectServiceModel.update(projectService[0].id, {
        enabled: 1
      });
      projectService[0].enabled = 1;
    }

    // Trigger auto-deployment via ServiceManager
    const serviceManager = ServiceManager.getInstance(WorkerRepository);
    const deploymentResult = await serviceManager.enableService(service.name, null, projectId);

    return {
      success: true,
      projectId,
      serviceId,
      serviceName: service.name,
      enabled: true,
      deployments: deploymentResult.deployments || []
    };
  }

  /**
   * Disable service for project (stops all deployments)
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object>} Disable result
   */
  async disableServiceForProject(projectId, serviceId) {
    // Verify project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Verify service exists
    const services = await Service.findAll({ where: { id: serviceId } });
    if (services.length === 0) {
      throw new Error('Service not found');
    }
    const service = services[0];
    const { isPlatformDeviceService } = require('../config/platformDeviceServices');
    if (isPlatformDeviceService(service.name)) {
      return {
        success: false,
        platform: true,
        projectId,
        serviceId,
        serviceName: service.name,
        enabled: true,
        message: `${service.name} is always-on per device`,
      };
    }

    // Update ProjectService to disabled
    const projectServices = await ProjectServiceModel.findAll({
      where: { project_id: projectId, service_id: serviceId }
    });

    if (projectServices.length > 0) {
      await ProjectServiceModel.update(projectServices[0].id, {
        enabled: 0
      });
    }

    // Stop all deployments for this service in this project
    const { ServiceDeployment } = require('../models');
    const deployments = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId,
        status: 'deployed'
      }
    });

    const serviceManager = ServiceManager.getInstance(WorkerRepository);
    const stoppedDeployments = [];

    for (const deployment of deployments) {
      try {
        // Get worker to send stop instruction
        const worker = await WorkerRepository.findById(deployment.worker_id);
        if (worker) {
          const project = await this.projectRepository.findById(projectId);
          const projectName = project ? project.name : null;

          await serviceManager.sendDeploymentInstruction(worker, {
            action: 'stop',
            service: service.name,
            project_id: projectId,
            project_name: projectName
          });

          // Update deployment status
          await ServiceDeployment.update(deployment.id, {
            status: 'stopped'
          });

          stoppedDeployments.push({
            deploymentId: deployment.id,
            workerId: deployment.worker_id
          });
        }
      } catch (error) {
        console.error(`[ProjectService] Error stopping deployment ${deployment.id}:`, error);
      }
    }

    return {
      success: true,
      projectId,
      serviceId,
      serviceName: service.name,
      enabled: false,
      stoppedDeployments: stoppedDeployments.length
    };
  }

  /**
   * Update service config for project
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @param {object} config - Service configuration (JSON object)
   * @returns {Promise<object>} Update result
   */
  async updateServiceConfigForProject(projectId, serviceId, config) {
    // Verify project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get or create ProjectService association
    let projectServices = await ProjectServiceModel.findAll({
      where: { project_id: projectId, service_id: serviceId }
    });

    if (projectServices.length === 0) {
      // Create association if it doesn't exist
      await ProjectServiceModel.create({
        project_id: projectId,
        service_id: serviceId,
        enabled: 0,
        config: JSON.stringify(config),
        scaling_policy: '{}'
      });
    } else {
      // Update config
      await ProjectServiceModel.update(projectServices[0].id, {
        config: JSON.stringify(config)
      });
    }

    return {
      success: true,
      projectId,
      serviceId,
      config
    };
  }

  /**
   * Update scaling policy for project
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @param {object} scalingPolicy - Scaling policy configuration
   * @returns {Promise<object>} Update result
   */
  async updateScalingPolicyForProject(projectId, serviceId, scalingPolicy) {
    // Verify project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Validate scaling policy structure
    const defaultPolicy = {
      min_instances: 1,
      max_instances: 10,
      target_cpu: 70,
      target_memory: 80,
      target_request_rate: null,
      scale_up_cooldown: 60,
      scale_down_cooldown: 300
    };

    const mergedPolicy = { ...defaultPolicy, ...scalingPolicy };

    // Get or create ProjectService association
    let projectServices = await ProjectServiceModel.findAll({
      where: { project_id: projectId, service_id: serviceId }
    });

    if (projectServices.length === 0) {
      // Create association if it doesn't exist
      await ProjectServiceModel.create({
        project_id: projectId,
        service_id: serviceId,
        enabled: 0,
        config: '{}',
        scaling_policy: JSON.stringify(mergedPolicy)
      });
    } else {
      // Update scaling policy
      await ProjectServiceModel.update(projectServices[0].id, {
        scaling_policy: JSON.stringify(mergedPolicy)
      });
    }

    return {
      success: true,
      projectId,
      serviceId,
      scalingPolicy: mergedPolicy
    };
  }

  /**
   * Get all projects for a worker
   * @param {string} workerId - Worker ID
   * @returns {Promise<Array>} Array of project objects
   */
  async getWorkerProjects(workerId) {
    return await this.projectRepository.getWorkerProjects(workerId);
  }

  /**
   * Get all projects for a service
   * @param {string} serviceId - Service ID
   * @returns {Promise<Array>} Array of project objects
   */
  async getServiceProjects(serviceId) {
    return await this.projectRepository.getServiceProjects(serviceId);
  }

  /**
   * Get all deployments for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Array of deployment objects
   */
  async getProjectDeployments(projectId) {
    return await this.projectRepository.getProjectDeployments(projectId);
  }

  /**
   * Get all orphaned deployments
   * @returns {Promise<Array>} Array of orphaned deployment objects
   */
  async getOrphanedDeployments() {
    return await this.projectRepository.getOrphanedDeployments();
  }

  /**
   * Send cleanup instructions to a worker for orphaned deployments
   * @param {string} workerId - Worker ID
   * @param {Array} orphanedDeploymentIds - Array of orphaned deployment IDs
   * @returns {Promise<object>} Cleanup instruction result
   */
  async cleanupOrphanedDeployments(workerId, orphanedDeploymentIds) {
    const sent = WorkerSocketService.sendOrphanCleanupInstruction(workerId, {
      orphanedDeploymentIds
    });

    return {
      success: sent,
      workerId,
      method: sent ? 'websocket' : 'queued'
    };
  }
}

// Export singleton instance
module.exports = new ProjectService(ProjectRepository);
