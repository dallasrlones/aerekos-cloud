const { Project, ProjectWorker, ProjectService, Worker, Service, ServiceDeployment } = require('../models');

/**
 * Project Repository - Database operations for projects
 */
class ProjectRepository {
  /**
   * Find project by ID
   * @param {string} id
   * @returns {Promise<object|null>} Project object or null
   */
  async findById(id) {
    const projects = await Project.findAll({ where: { id } });
    return projects.length > 0 ? projects[0] : null;
  }

  /**
   * Find project by name
   * @param {string} name
   * @returns {Promise<object|null>} Project object or null
   */
  async findByName(name) {
    const projects = await Project.findAll({ where: { name } });
    return projects.length > 0 ? projects[0] : null;
  }

  /**
   * Get all projects
   * @param {object} options - Optional query options (where, orderBy, etc.)
   * @returns {Promise<Array>} Array of projects
   */
  async findAll(options = {}) {
    return await Project.findAll(options);
  }

  /**
   * Create a new project
   * @param {object} projectData - Project data (name, description, enabled, config)
   * @returns {Promise<object>} Created project
   */
  async create(projectData) {
    return await Project.create(projectData);
  }

  /**
   * Update project
   * @param {string} id - Project ID
   * @param {object} projectData - Updated project data
   * @returns {Promise<object>} Updated project
   */
  async update(id, projectData) {
    const project = await this.findById(id);
    if (!project) {
      throw new Error('Project not found');
    }
    return await Project.update(id, projectData);
  }

  /**
   * Delete project
   * @param {string} id - Project ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const project = await this.findById(id);
    if (!project) {
      throw new Error('Project not found');
    }
    await Project.delete(id);
    return true;
  }

  /**
   * Get all workers assigned to a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Array of worker objects
   */
  async getWorkers(projectId) {
    const projectWorkers = await ProjectWorker.findAll({ where: { project_id: projectId } });
    const workers = [];
    
    for (const pw of projectWorkers) {
      const worker = await Worker.findAll({ where: { id: pw.worker_id } });
      if (worker.length > 0) {
        workers.push(worker[0]);
      }
    }
    
    return workers;
  }

  /**
   * Get all services assigned to a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Array of service objects
   */
  async getServices(projectId) {
    const projectServices = await ProjectService.findAll({ where: { project_id: projectId } });
    const services = [];
    
    for (const ps of projectServices) {
      const service = await Service.findAll({ where: { id: ps.service_id } });
      if (service.length > 0) {
        services.push({
          ...service[0],
          enabled: ps.enabled === 1 || ps.enabled === true ? 1 : 0,
        });
      }
    }
    
    return services;
  }

  /**
   * Assign worker to project
   * @param {string} projectId - Project ID
   * @param {string} workerId - Worker ID
   * @returns {Promise<object>} Created ProjectWorker association
   */
  async assignWorker(projectId, workerId) {
    // Check if association already exists
    const existing = await ProjectWorker.findAll({
      where: { project_id: projectId, worker_id: workerId }
    });
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    return await ProjectWorker.create({
      project_id: projectId,
      worker_id: workerId
    });
  }

  /**
   * Unassign worker from project
   * @param {string} projectId - Project ID
   * @param {string} workerId - Worker ID
   * @returns {Promise<boolean>} True if unassigned
   */
  async unassignWorker(projectId, workerId) {
    const projectWorkers = await ProjectWorker.findAll({
      where: { project_id: projectId, worker_id: workerId }
    });
    
    for (const pw of projectWorkers) {
      await ProjectWorker.delete(pw.id);
    }
    
    return true;
  }

  /**
   * Assign service to project
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<object>} Created ProjectService association
   */
  async assignService(projectId, serviceId) {
    // Check if association already exists
    const existing = await ProjectService.findAll({
      where: { project_id: projectId, service_id: serviceId }
    });
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    return await ProjectService.create({
      project_id: projectId,
      service_id: serviceId
    });
  }

  /**
   * Unassign service from project
   * @param {string} projectId - Project ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<boolean>} True if unassigned
   */
  async unassignService(projectId, serviceId) {
    const projectServices = await ProjectService.findAll({
      where: { project_id: projectId, service_id: serviceId }
    });
    
    for (const ps of projectServices) {
      await ProjectService.delete(ps.id);
    }
    
    return true;
  }

  /**
   * Get all projects for a worker
   * @param {string} workerId - Worker ID
   * @returns {Promise<Array>} Array of project objects
   */
  async getWorkerProjects(workerId) {
    const projectWorkers = await ProjectWorker.findAll({ where: { worker_id: workerId } });
    const projects = [];
    
    for (const pw of projectWorkers) {
      const project = await Project.findAll({ where: { id: pw.project_id } });
      if (project.length > 0) {
        projects.push(project[0]);
      }
    }
    
    return projects;
  }

  /**
   * Get all projects for a service
   * @param {string} serviceId - Service ID
   * @returns {Promise<Array>} Array of project objects
   */
  async getServiceProjects(serviceId) {
    const projectServices = await ProjectService.findAll({ where: { service_id: serviceId } });
    const projects = [];
    
    for (const ps of projectServices) {
      const project = await Project.findAll({ where: { id: ps.project_id } });
      if (project.length > 0) {
        projects.push(project[0]);
      }
    }
    
    return projects;
  }

  /**
   * Get all deployments for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Array of deployment objects
   */
  async getProjectDeployments(projectId) {
    return await ServiceDeployment.findAll({ where: { project_id: projectId } });
  }

  /**
   * Get all orphaned deployments (deployments with orphaned flag set)
   * @returns {Promise<Array>} Array of orphaned deployment objects
   */
  async getOrphanedDeployments() {
    return await ServiceDeployment.findAll({ where: { orphaned: 1 } });
  }

  /**
   * Delete all ProjectWorker associations for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<number>} Number of deleted associations
   */
  async deleteAllWorkerAssociations(projectId) {
    const projectWorkers = await ProjectWorker.findAll({ where: { project_id: projectId } });
    let count = 0;
    
    for (const pw of projectWorkers) {
      await ProjectWorker.delete(pw.id);
      count++;
    }
    
    return count;
  }

  /**
   * Delete all ProjectService associations for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<number>} Number of deleted associations
   */
  async deleteAllServiceAssociations(projectId) {
    const projectServices = await ProjectService.findAll({ where: { project_id: projectId } });
    let count = 0;
    
    for (const ps of projectServices) {
      await ProjectService.delete(ps.id);
      count++;
    }
    
    return count;
  }

  /**
   * Flag all deployments for a project as orphaned and detach from project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Array of updated deployment IDs
   */
  async flagDeploymentsAsOrphaned(projectId) {
    const deployments = await ServiceDeployment.findAll({ where: { project_id: projectId } });
    const updatedIds = [];
    
    for (const deployment of deployments) {
      await ServiceDeployment.update(deployment.id, {
        orphaned: 1,
        project_id: null // Detach from project
      });
      updatedIds.push(deployment.id);
    }
    
    return updatedIds;
  }
}

module.exports = new ProjectRepository();
