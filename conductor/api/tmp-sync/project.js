const express = require('express');
const router = express.Router();
const ProjectService = require('../services/ProjectService');
const authenticate = require('../middleware/auth');

/**
 * GET /api/projects
 * List all projects
 * Protected route
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const projects = await ProjectService.listProjects();
    
    res.json({
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        enabled: p.enabled === 1,
        config: p.config,
        workerCount: p.workerCount,
        serviceCount: p.serviceCount,
        deploymentCount: p.deploymentCount,
        created_at: p.created_at,
        updated_at: p.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

const { requireProjectMember } = require('../middleware/requireProjectMember');
router.use('/:id', authenticate, requireProjectMember);

router.get('/:id/environments', authenticate, async (req, res, next) => {
  try {
    const EnvironmentService = require('../services/EnvironmentService');
    const { isSystemProject } = require('../config/systemProject');
    const project = await ProjectService.getProject(req.params.id);
    const system = isSystemProject(req.params.id) || String(project?.name || '').toLowerCase() === 'system';
    const environments = system
      ? await EnvironmentService.ensureForProject(req.params.id, project?.name)
      : await EnvironmentService.list(req.params.id);
    res.json({ environments });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/environments', authenticate, async (req, res, next) => {
  try {
    const EnvironmentService = require('../services/EnvironmentService');
    const environment = await EnvironmentService.create(req.params.id, req.body || {});
    res.status(201).json({ environment });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: { message: error.message, status: error.status } });
    next(error);
  }
});

router.post('/:id/environments/:name/duplicate', authenticate, async (req, res, next) => {
  try {
    const EnvironmentService = require('../services/EnvironmentService');
    const result = await EnvironmentService.duplicate(
      req.params.id,
      req.params.name,
      req.body?.target || req.body?.name,
      { authorization: req.headers.authorization }
    );
    res.status(201).json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: { message: error.message, status: error.status } });
    next(error);
  }
});

/**
 * GET /api/projects/:id
 * Get project details
 * Protected route
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await ProjectService.getProject(id);
    
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }
    
    res.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        enabled: project.enabled === 1,
        config: project.config,
        workers: project.workers.map(w => ({
          id: w.id,
          hostname: w.hostname,
          ip_address: w.ip_address,
          status: w.status
        })),
        services: project.services.map(s => ({
          id: s.id,
          name: s.name,
          enabled: s.enabled === 1,
          docker_image: s.docker_image
        })),
        deployments: project.deployments.map(d => ({
          id: d.id,
          service_id: d.service_id,
          worker_id: d.worker_id,
          project_id: d.project_id,
          status: d.status,
          deployed_at: d.deployed_at,
          orphaned: d.orphaned === 1
        })),
        workerCount: project.workerCount,
        serviceCount: project.serviceCount,
        deploymentCount: project.deploymentCount,
        created_at: project.created_at,
        updated_at: project.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects
 * Create new project
 * Protected route
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, description, enabled, config, default_environment } = req.body;
    
    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        error: {
          message: 'Project name is required and must be at least 3 characters',
          status: 400
        }
      });
    }
    
    const project = await ProjectService.createProject({
      name: name.trim(),
      description: description || '',
      enabled: enabled !== undefined ? enabled : true,
      config: config || {},
      default_environment
    });
    try {
      const IacHookupService = require('../services/IacHookupService');
      IacHookupService.ensureEnabled(project.id, req.headers.authorization).catch((err) => {
        console.warn('[projects] iac enable:', err.message);
      });
    } catch (err) {
      console.warn('[projects] iac enable skipped:', err.message);
    }

    try {
      const { seedGatewayRoutesForProject } = require('../services/GatewayBootstrapService');
      seedGatewayRoutesForProject(project.id).catch((err) => {
        console.warn('[projects] gateway seed:', err.message);
      });
    } catch (err) {
      console.warn('[projects] gateway seed skipped:', err.message);
    }

    try {
      const ServiceManager = require('../services/ServiceManager');
      const WorkerRepository = require('../repos/WorkerRepository');
      const sm = ServiceManager.getInstance(WorkerRepository);
      sm.proxyServiceRequest(
        'network_manager',
        'POST',
        '/api/v1/networks',
        { project_id: project.id, name: 'default' },
        {},
        project.id,
      ).catch((err) => console.warn('[projects] default network:', err.message));
    } catch (err) {
      console.warn('[projects] default network skipped:', err.message);
    }
    
    res.status(201).json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        enabled: project.enabled === 1,
        config: project.config,
        isFirst: project.isFirst,
        created_at: project.created_at,
        updated_at: project.updated_at
      }
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          message: error.message,
          status: 409
        }
      });
    }
    next(error);
  }
});

/**
 * PUT /api/projects/:id
 * Update project
 * Protected route
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, enabled, config, default_environment } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (config !== undefined) updateData.config = config;
    if (default_environment !== undefined) updateData.default_environment = default_environment;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: {
          message: 'At least one field must be provided for update',
          status: 400
        }
      });
    }
    
    const project = await ProjectService.updateProject(id, updateData);
    
    res.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        enabled: project.enabled === 1,
        config: project.config,
        created_at: project.created_at,
        updated_at: project.updated_at
      }
    });
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          message: error.message,
          status: 409
        }
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project (transactional - flags deployments as orphaned)
 * Protected route
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await ProjectService.deleteProject(id);
    
    res.json({
      success: true,
      message: `Project ${result.projectName} deleted successfully`,
      orphanedDeploymentCount: result.orphanedDeploymentCount,
      orphanedDeploymentIds: result.orphanedDeploymentIds,
      cleanupJobIds: result.cleanupJobIds
    });
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * POST /api/projects/:id/workers/:workerId
 * Assign worker to project
 * Protected route
 */
router.post('/:id/workers/:workerId', authenticate, async (req, res, next) => {
  try {
    const { id, workerId } = req.params;
    const result = await ProjectService.assignWorkerToProject(id, workerId);
    
    res.json({
      success: true,
      projectId: result.projectId,
      workerId: result.workerId
    });
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/projects/:id/workers/:workerId
 * Unassign worker from project
 * Protected route
 */
router.delete('/:id/workers/:workerId', authenticate, async (req, res, next) => {
  try {
    const { id, workerId } = req.params;
    const result = await ProjectService.unassignWorkerFromProject(id, workerId);
    
    res.json({
      success: true,
      projectId: result.projectId,
      workerId: result.workerId
    });
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * POST /api/projects/:id/services/:serviceId
 * Assign service to project
 * Protected route
 */
router.post('/:id/services/:serviceId', authenticate, async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;
    const result = await ProjectService.assignServiceToProject(id, serviceId);
    
    res.json({
      success: true,
      projectId: result.projectId,
      serviceId: result.serviceId
    });
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/projects/:id/services/:serviceId
 * Unassign service from project
 * Protected route
 */
router.delete('/:id/services/:serviceId', authenticate, async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;
    const result = await ProjectService.unassignServiceFromProject(id, serviceId);
    
    res.json({
      success: true,
      projectId: result.projectId,
      serviceId: result.serviceId
    });
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * GET /api/projects/:id/deployments
 * Get project deployments
 * Protected route
 */
router.get('/:id/deployments', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deployments = await ProjectService.getProjectDeployments(id);
    
    res.json({
      deployments: deployments.map(d => ({
        id: d.id,
        service_id: d.service_id,
        worker_id: d.worker_id,
        project_id: d.project_id,
        status: d.status,
        deployed_at: d.deployed_at,
        orphaned: d.orphaned === 1,
        created_at: d.created_at,
        updated_at: d.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:id/services/:serviceId/enable
 * Enable service for project (triggers auto-deployment)
 * Protected route
 */
router.post('/:id/services/:serviceId/enable', authenticate, async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;
    const result = await ProjectService.enableServiceForProject(id, serviceId, req.body?.worker_id || null);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message === 'Project not found' || error.message === 'Service not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

router.get('/:id/setup-summary', authenticate, async (req, res, next) => {
  try {
    const SetupService = require('../services/SetupService');
    res.json(await SetupService.getProjectSetupSummary(req.params.id, req.headers.authorization));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/enable-core-stack', authenticate, async (req, res, next) => {
  try {
    const SetupService = require('../services/SetupService');
    const result = await SetupService.enablePack(req.params.id, 'core', { defaults: true });
    res.json({ projectId: req.params.id, results: result.results, enabled: result.enabled, defaults: result.defaults });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:id/services/:serviceId/disable
 * Disable service for project (stops all deployments)
 * Protected route
 */
router.post('/:id/services/:serviceId/disable', authenticate, async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;
    const result = await ProjectService.disableServiceForProject(id, serviceId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message === 'Project not found' || error.message === 'Service not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * PUT /api/projects/:id/services/:serviceId/config
 * Update service config for project
 * Protected route
 */
router.put('/:id/services/:serviceId/config', authenticate, async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        error: {
          message: 'Config must be a valid JSON object',
          status: 400
        }
      });
    }

    const result = await ProjectService.updateServiceConfigForProject(id, serviceId, config);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * PUT /api/projects/:id/services/:serviceId/scaling
 * Update scaling policy for project
 * Protected route
 */
router.put('/:id/services/:serviceId/scaling', authenticate, async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;
    // The entire request body should be the scaling policy object
    const scalingPolicy = req.body;

    // Check if body is valid - must be an object, not array, not null, not string
    // Also check if it's an empty object (which is valid) or has invalid structure
    if (!scalingPolicy || typeof scalingPolicy !== 'object' || Array.isArray(scalingPolicy)) {
      return res.status(400).json({
        error: {
          message: 'Scaling policy must be a valid JSON object',
          status: 400
        }
      });
    }

    // Additional check: if body has a single property that's a string, it's likely wrong
    const keys = Object.keys(scalingPolicy);
    if (keys.length === 1 && typeof scalingPolicy[keys[0]] === 'string' && keys[0] !== 'target_request_rate') {
      // This might be a misformatted request where scalingPolicy was wrapped
      // But we'll allow it and let the service handle it
    }

    const result = await ProjectService.updateScalingPolicyForProject(id, serviceId, scalingPolicy);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          status: 404
        }
      });
    }
    next(error);
  }
});

const StackService = require('../services/StackService');

router.get('/:id/stack', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.current(req.params.id));
  } catch (err) { next(err); }
});

router.put('/:id/stack', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.put(req.params.id, req.body || {}));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

router.post('/:id/stack/record', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.record(req.params.id, req.body || {}));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

router.delete('/:id/stack/record', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.unrecord(req.params.id, req.body || {}));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

router.post('/:id/stack/sync', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.sync(req.params.id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

router.post('/:id/stack/diff', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.diff(req.params.id));
  } catch (err) { next(err); }
});

router.post('/:id/stack/apply', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.apply(req.params.id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

router.get('/:id/stack/revisions', authenticate, async (req, res, next) => {
  try {
    res.json({ revisions: await StackService.revisions(req.params.id) });
  } catch (err) { next(err); }
});

router.post('/:id/stack/rollback', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.rollback(req.params.id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
});

router.get('/:id/stack/drift', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.drift(req.params.id));
  } catch (err) { next(err); }
});

router.post('/:id/stack/propose', authenticate, async (req, res, next) => {
  try {
    res.json(await StackService.propose(req.params.id, req.body?.prompt));
  } catch (err) { next(err); }
});

router.get('/:id/iac/status', authenticate, async (req, res, next) => {
  try {
    const IacHookupService = require('../services/IacHookupService');
    res.json(await IacHookupService.status(req.params.id, req.headers.authorization));
  } catch (err) { next(err); }
});

router.post('/:id/iac/hookup', authenticate, async (req, res, next) => {
  try {
    const IacHookupService = require('../services/IacHookupService');
    res.json(await IacHookupService.hookup(req.params.id, req.body || {}, req.headers.authorization));
  } catch (err) { next(err); }
});

router.get('/:id/edge/status', authenticate, async (req, res, next) => {
  try {
    const EdgeService = require('../services/EdgeService');
    res.json(await EdgeService.hookupStatus(req.params.id, req.headers.authorization));
  } catch (err) { next(err); }
});

router.post('/:id/edge/hookup', authenticate, async (req, res, next) => {
  try {
    const EdgeService = require('../services/EdgeService');
    res.json(await EdgeService.hookup(req.params.id, req.headers.authorization));
  } catch (err) { next(err); }
});

router.get('/:id/members', authenticate, async (req, res, next) => {
  try {
    const { ProjectMember } = require('../models');
    const members = await ProjectMember.findAll({ where: { project_id: req.params.id } });
    res.json({ members });
  } catch (err) { next(err); }
});

router.post('/:id/members', authenticate, async (req, res, next) => {
  try {
    const { ProjectMember } = require('../models');
    const row = await ProjectMember.create({
      project_id: req.params.id,
      user_id: req.body.user_id,
      role: req.body.role || 'member',
    });
    res.status(201).json({ member: row });
  } catch (err) { next(err); }
});

router.get('/:id/export', authenticate, async (req, res, next) => {
  try {
    const project = await ProjectService.getProject(req.params.id);
    res.json({ project: { id: project.id, name: project.name, description: project.description, config: project.config } });
  } catch (err) { next(err); }
});

router.post('/:id/import', authenticate, async (req, res, next) => {
  try {
    const incoming = req.body?.project || req.body || {};
    const patch = {};
    if (incoming.description != null) patch.description = incoming.description;
    if (incoming.config != null) patch.config = typeof incoming.config === 'string' ? incoming.config : JSON.stringify(incoming.config);
    if (Object.keys(patch).length) await ProjectService.updateProject(req.params.id, patch);
    const project = await ProjectService.getProject(req.params.id);
    res.json({ project, imported: true });
  } catch (err) { next(err); }
});

router.post('/:id/edge/import-tunnels', authenticate, async (req, res, next) => {
  try {
    const EdgeService = require('../services/EdgeService');
    res.json(await EdgeService.importLiveTunnels(req.params.id, req.headers.authorization));
  } catch (err) { next(err); }
});

module.exports = router;
