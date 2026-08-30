const { getModels } = require('../models');

class ProjectRepository {
  async create(projectData) {
    const models = await getModels();
    if (!models || !models.Project) {
      throw new Error('Models not initialized. Project model is not available.');
    }
    const { Project } = models;
    return await Project.create(projectData);
  }
  
  async findById(id) {
    const models = await getModels();
    if (!models || !models.Project) {
      throw new Error('Models not initialized. Project model is not available.');
    }
    const { Project } = models;
    return await Project.find(id);
  }
  
  async findByName(name) {
    const models = await getModels();
    if (!models || !models.Project) {
      throw new Error('Models not initialized. Project model is not available.');
    }
    const { Project } = models;
    const results = await Project.findAll({ where: { name } });
    return results.length > 0 ? results[0] : null;
  }
  
  async findAll(filter = {}) {
    const models = await getModels();
    if (!models || !models.Project) {
      throw new Error('Models not initialized. Project model is not available.');
    }
    const { Project } = models;
    return await Project.findAll(filter);
  }
  
  async update(id, projectData) {
    const models = await getModels();
    if (!models || !models.Project) {
      throw new Error('Models not initialized. Project model is not available.');
    }
    const { Project } = models;
    return await Project.update(id, projectData);
  }
  
  async delete(id) {
    const models = await getModels();
    if (!models || !models.Project) {
      throw new Error('Models not initialized. Project model is not available.');
    }
    const { Project } = models;
    return await Project.delete(id);
  }
}

module.exports = ProjectRepository;
