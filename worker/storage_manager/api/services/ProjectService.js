const ProjectRepository = require('../repos/ProjectRepository');
const BucketRepository = require('../repos/BucketRepository');
const logger = require('../utils/logger');

class ProjectService {
  constructor() {
    this.projectRepo = new ProjectRepository();
    this.bucketRepo = new BucketRepository();
  }
  
  /**
   * Create a new project
   */
  async createProject(name, createdBy, metadata = {}) {
    // Check if project already exists
    const existing = await this.projectRepo.findByName(name);
    if (existing) {
      throw new Error(`Project '${name}' already exists`);
    }
    
    const project = await this.projectRepo.create({
      name,
      created_by: createdBy,
      metadata: JSON.stringify(metadata)
    });
    
    logger.info(`[ProjectService] Created project: ${name}`);
    return project;
  }
  
  /**
   * Get project by ID
   */
  async getProject(projectId) {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error(`Project '${projectId}' not found`);
    }
    
    if (project.metadata) {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    
    return project;
  }
  
  /**
   * Get project by name
   */
  async getProjectByName(name) {
    const project = await this.projectRepo.findByName(name);
    if (!project) {
      throw new Error(`Project '${name}' not found`);
    }
    
    if (project.metadata) {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    
    return project;
  }
  
  /**
   * List all projects
   */
  async listProjects(filter = {}) {
    const projects = await this.projectRepo.findAll(filter);
    
    // Parse metadata JSON
    return projects.map(project => {
      if (project.metadata) {
        try {
          project.metadata = JSON.parse(project.metadata);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      return project;
    });
  }
  
  /**
   * Update project metadata
   */
  async updateProject(projectId, updates) {
    const project = await this.getProject(projectId);
    
    const updateData = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.metadata) {
      updateData.metadata = typeof updates.metadata === 'string' 
        ? updates.metadata 
        : JSON.stringify(updates.metadata);
    }
    
    return await this.projectRepo.update(projectId, updateData);
  }
  
  /**
   * Delete project (must be empty)
   */
  async deleteProject(projectId) {
    const project = await this.getProject(projectId);
    
    // Check if project has buckets
    const buckets = await this.bucketRepo.findByProject(projectId);
    if (buckets.length > 0) {
      throw new Error(`Cannot delete project '${project.name}': project has ${buckets.length} bucket(s)`);
    }
    
    await this.projectRepo.delete(projectId);
    logger.info(`[ProjectService] Deleted project: ${project.name}`);
  }
}

module.exports = ProjectService;
