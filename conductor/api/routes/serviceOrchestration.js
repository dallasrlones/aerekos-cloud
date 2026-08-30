const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { ServiceDeployment, ProjectService } = require('../models');
const ServiceOrchestrator = require('../services/ServiceOrchestrator');
const ProjectRepository = require('../repos/ProjectRepository');
const WorkerRepository = require('../repos/WorkerRepository');

/**
 * POST /api/projects/:projectId/services/:serviceId/pin/:workerId
 * Pin service to specific worker (overrides auto-assignment)
 * Protected route
 */
router.post('/projects/:projectId/services/:serviceId/pin/:workerId', authenticate, async (req, res, next) => {
  try {
    const { projectId, serviceId, workerId } = req.params;

    // Verify project exists
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Verify worker exists and is assigned to project
    const worker = await WorkerRepository.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }

    const projectWorkers = await ProjectRepository.getWorkers(projectId);
    const isAssigned = projectWorkers.some(w => w.id === workerId);
    if (!isAssigned) {
      return res.status(400).json({
        error: {
          message: 'Worker is not assigned to this project',
          status: 400
        }
      });
    }

    // Find or create ServiceDeployment and update pinning
    const deployments = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId
      }
    });

    if (deployments.length > 0) {
      // Update existing deployment(s) with pinning
      for (const deployment of deployments) {
        await ServiceDeployment.update(deployment.id, {
          pinned_worker_id: workerId
        });
      }
    } else {
      // Create new deployment record with pinning (status will be set when actually deployed)
      await ServiceDeployment.create({
        project_id: projectId,
        service_id: serviceId,
        worker_id: workerId,
        pinned_worker_id: workerId,
        status: 'pending'
      });
    }

    res.json({
      success: true,
      message: `Service ${serviceId} pinned to worker ${workerId}`,
      projectId,
      serviceId,
      workerId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/projects/:projectId/services/:serviceId/pin
 * Unpin service (allow auto-assignment)
 * Protected route
 */
router.delete('/projects/:projectId/services/:serviceId/pin', authenticate, async (req, res, next) => {
  try {
    const { projectId, serviceId } = req.params;

    // Verify project exists
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Find deployments and remove pinning
    const deployments = await ServiceDeployment.findAll({
      where: {
        project_id: projectId,
        service_id: serviceId
      }
    });

    if (deployments.length === 0) {
      return res.status(404).json({
        error: {
          message: 'No deployments found for this service',
          status: 404
        }
      });
    }

    // Remove pinning from all deployments
    for (const deployment of deployments) {
      await ServiceDeployment.update(deployment.id, {
        pinned_worker_id: null
      });
    }

    res.json({
      success: true,
      message: `Service ${serviceId} unpinned (auto-assignment enabled)`,
      projectId,
      serviceId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/services/:serviceId/deploy
 * Manually trigger deployment (with auto-assignment)
 * Protected route
 */
router.post('/projects/:projectId/services/:serviceId/deploy', authenticate, async (req, res, next) => {
  try {
    const { projectId, serviceId } = req.params;
    const { placementStrategy, minInstances, maxInstances, resourceRequirements } = req.body;

    // Verify project exists
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: {
          message: 'Project not found',
          status: 404
        }
      });
    }

    // Find optimal workers
    const workerIds = await ServiceOrchestrator.findOptimalWorkers(projectId, serviceId, {
      placementStrategy: placementStrategy || 'binpack',
      minInstances: minInstances || 1,
      maxInstances: maxInstances || 1,
      resourceRequirements: resourceRequirements || {}
    });

    res.json({
      success: true,
      message: `Selected ${workerIds.length} worker(s) for deployment`,
      projectId,
      serviceId,
      selectedWorkers: workerIds,
      placementStrategy: placementStrategy || 'binpack'
    });
  } catch (error) {
    if (error.message.includes('No workers')) {
      return res.status(400).json({
        error: {
          message: error.message,
          status: 400
        }
      });
    }
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/services/:serviceId/assignments
 * Get current service assignments and load distribution
 * Protected route
 */
router.get('/projects/:projectId/services/:serviceId/assignments', authenticate, async (req, res, next) => {
  try {
    const { projectId, serviceId } = req.params;

    const distribution = await ServiceOrchestrator.calculateLoadDistribution(projectId, serviceId);
    const pinning = await ServiceOrchestrator.checkDevicePinning(projectId, serviceId);

    res.json({
      success: true,
      projectId,
      serviceId,
      distribution,
      pinning: pinning || null
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/services/:serviceId/scaling
 * Check if service should scale horizontally
 * Protected route
 */
router.get('/projects/:projectId/services/:serviceId/scaling', authenticate, async (req, res, next) => {
  try {
    const { projectId, serviceId } = req.params;

    const scalingDecision = await ServiceOrchestrator.shouldScaleHorizontally(projectId, serviceId);

    res.json({
      success: true,
      projectId,
      serviceId,
      scaling: scalingDecision
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/workers/:workerId/resources
 * Get available resources for a worker
 * Protected route
 */
router.get('/workers/:workerId/resources', authenticate, async (req, res, next) => {
  try {
    const { workerId } = req.params;

    const resources = await ServiceOrchestrator.getAvailableResources(workerId);

    res.json({
      success: true,
      workerId,
      resources
    });
  } catch (error) {
    if (error.message.includes('not found')) {
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
 * POST /api/projects/:projectId/services/:serviceId/load-balancer/configure
 * Configure load balancer for a service
 * Protected route
 */
router.post('/projects/:projectId/services/:serviceId/load-balancer/configure', authenticate, async (req, res, next) => {
  try {
    const { projectId, serviceId } = req.params;
    const { algorithm, healthCheckInterval, maxFailures } = req.body;

    const LoadBalancer = require('../services/LoadBalancer');
    const result = await LoadBalancer.configureLoadBalancer(projectId, serviceId, {
      algorithm,
      healthCheckInterval,
      maxFailures
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message.includes('Invalid load balancing algorithm')) {
      return res.status(400).json({
        error: {
          message: error.message,
          status: 400
        }
      });
    }
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/services/:serviceId/load-balancer/statistics
 * Get load balancer statistics
 * Protected route
 */
router.get('/projects/:projectId/services/:serviceId/load-balancer/statistics', authenticate, async (req, res, next) => {
  try {
    const { projectId, serviceId } = req.params;

    const LoadBalancer = require('../services/LoadBalancer');
    const stats = await LoadBalancer.getStatistics(projectId, serviceId);

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
