const express = require('express');
const ProjectService = require('../services/ProjectService');
const validateServiceToken = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');

const router = express.Router();
const projectService = new ProjectService();

// POST /api/projects - Create project
router.post('/', validateServiceToken, async (req, res, next) => {
  try {
    const { name, metadata } = req.body;
    const createdBy = req.service?.name || 'unknown';
    
    if (!name) {
      return res.status(400).json({
        error: { message: 'Project name is required', status: 400 }
      });
    }
    
    const project = await projectService.createProject(name, createdBy, metadata);
    
    res.status(201).json(project);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: { message: error.message, status: 409 }
      });
    }
    next(error);
  }
});

// GET /api/projects - List all projects
router.get('/', validateServiceToken, async (req, res, next) => {
  try {
    const projects = await projectService.listProjects();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:projectId - Get project details
router.get('/:projectId', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await projectService.getProject(projectId);
    res.json(project);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// DELETE /api/projects/:projectId - Delete project
router.delete('/:projectId', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    await projectService.deleteProject(projectId);
    res.status(204).end();
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    if (error.message.includes('has')) {
      return res.status(409).json({
        error: { message: error.message, status: 409 }
      });
    }
    next(error);
  }
});

// PATCH /api/projects/:projectId - Update project
router.patch('/:projectId', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, metadata } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (metadata) updates.metadata = metadata;
    
    const project = await projectService.updateProject(projectId, updates);
    res.json(project);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

module.exports = router;
