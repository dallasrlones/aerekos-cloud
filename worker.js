const express = require('express');
const router = express.Router();
const WorkerService = require('../services/WorkerService');
const ProjectService = require('../services/ProjectService');
const authenticate = require('../middleware/auth');
const { versionInfo, targetVersion } = require('../utils/version');
const UpdateService = require('../services/UpdateService');

/**
 * POST /api/workers/register
 * Register a new worker with the conductor
 * Requires registration token in request body
 */
router.post('/register', async (req, res, next) => {
  try {
    const { token, hostname, ip_address, resources, worker_id, project_ids } = req.body;

    if (!token) {
      return res.status(400).json({
        error: {
          message: 'Registration token is required',
          status: 400
        }
      });
    }

    // If worker_id is provided, pass it to registerWorker to use existing worker if valid

    // Use provided hostname/IP if available (actual device info), otherwise detect from request
    let workerHostname = hostname;
    let workerIP = ip_address;

    // If not provided, detect from request (fallback for older workers)
    if (!workerHostname || !workerIP) {
      // Detect IP address from request
      // Try X-Forwarded-For header first (for proxies), then req.ip, then req.connection.remoteAddress
      const detectedIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                       req.ip || 
                       req.connection?.remoteAddress ||
                       req.socket?.remoteAddress ||
                       'unknown';

      // Detect hostname from request headers or use IP
      const detectedHostname = req.headers['x-forwarded-host'] ||
                               req.headers['host']?.split(':')[0] ||
                               req.hostname ||
                               detectedIP;

      workerHostname = workerHostname || detectedHostname;
      workerIP = workerIP || detectedIP;
    }

    const worker = await WorkerService.registerWorker(
      token, 
      workerHostname, 
      workerIP, 
      resources || {}, 
      worker_id,
      project_ids || []
    );
    
    res.status(201).json({
      worker: {
        id: worker.id,
        hostname: worker.hostname,
        ip_address: worker.ip_address,
        status: worker.status,
        last_seen: worker.last_seen,
        resources: worker.resources,
        projects: worker.projects || [],
        created_at: worker.created_at,
        updated_at: worker.updated_at
      }
    });
  } catch (error) {
    if (error.message === 'Invalid registration token') {
      return res.status(401).json({
        error: {
          message: 'Invalid registration token',
          status: 401
        }
      });
    }
    next(error);
  }
});

/**
 * POST /api/workers/:id/heartbeat
 * Send heartbeat from worker to conductor
 */
router.post('/:id/heartbeat', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const worker = await WorkerService.sendHeartbeat(id);
    
    res.json({
      worker: {
        id: worker.id,
        hostname: worker.hostname,
        ip_address: worker.ip_address,
        status: worker.status,
        last_seen: worker.last_seen,
        resources: worker.resources
      }
    });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * PUT /api/workers/:id/resources
 * Update worker resource information
 */
router.put('/:id/resources', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resources } = req.body;

    if (!resources) {
      return res.status(400).json({
        error: {
          message: 'Resources data is required',
          status: 400
        }
      });
    }

    const worker = await WorkerService.updateResources(id, resources);
    
    res.json({
      worker: {
        id: worker.id,
        hostname: worker.hostname,
        ip_address: worker.ip_address,
        status: worker.status,
        last_seen: worker.last_seen,
        resources: worker.resources
      }
    });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * GET /api/workers
 * Get all workers
 * Protected route - requires authentication
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const workers = await WorkerService.getAllWorkers();
    const baseline = targetVersion();
    
    res.json({
      workers: workers.map(worker => ({
        id: worker.id,
        hostname: worker.hostname,
        ip_address: worker.ip_address,
        status: worker.status,
        last_seen: worker.last_seen,
        resources: worker.resources,
        projects: worker.projects || [],
        created_at: worker.created_at,
        updated_at: worker.updated_at,
        ...versionInfo(worker, baseline)
      }))
    });
  } catch (error) {
    next(error);
  }
});

const { workerAgentRequest } = require('../utils/workerAgent');

/**
 * GET /api/workers/:id/containers — list Docker containers on device
 */
router.get('/:id/containers', authenticate, async (req, res, next) => {
  try {
    const worker = await WorkerService.getWorker(req.params.id);
    const data = await workerAgentRequest(worker, 'get', '/api/containers');
    res.json(data);
  } catch (error) {
    if (error.message === 'Worker not found') return res.status(404).json({ error: { message: error.message } });
    res.status(error.status || 502).json({ error: { message: error.message } });
  }
});

router.post('/:id/containers/:containerId/start', authenticate, async (req, res, next) => {
  try {
    const worker = await WorkerService.getWorker(req.params.id);
    const data = await workerAgentRequest(worker, 'post', `/api/containers/${req.params.containerId}/start`);
    res.json(data);
  } catch (error) {
    if (error.message === 'Worker not found') return res.status(404).json({ error: { message: error.message } });
    res.status(error.status || 502).json({ error: { message: error.message } });
  }
});

router.post('/:id/containers/:containerId/stop', authenticate, async (req, res, next) => {
  try {
    const worker = await WorkerService.getWorker(req.params.id);
    const data = await workerAgentRequest(worker, 'post', `/api/containers/${req.params.containerId}/stop`);
    res.json(data);
  } catch (error) {
    if (error.message === 'Worker not found') return res.status(404).json({ error: { message: error.message } });
    res.status(error.status || 502).json({ error: { message: error.message } });
  }
});

router.get('/:id/containers/:containerId/logs', authenticate, async (req, res, next) => {
  try {
    const worker = await WorkerService.getWorker(req.params.id);
    const data = await workerAgentRequest(worker, 'get', `/api/containers/${req.params.containerId}/logs`, {
      params: { tail: req.query.tail, since: req.query.since },
      timeout: 60000,
    });
    res.json(data);
  } catch (error) {
    if (error.message === 'Worker not found') return res.status(404).json({ error: { message: error.message } });
    res.status(error.status || 502).json({ error: { message: error.message } });
  }
});

router.post('/:id/containers/:containerId/exec', authenticate, async (req, res, next) => {
  try {
    const worker = await WorkerService.getWorker(req.params.id);
    const data = await workerAgentRequest(worker, 'post', `/api/containers/${req.params.containerId}/exec`, {
      data: { cmd: req.body?.cmd, tty: req.body?.tty },
      timeout: 120000,
    });
    res.json(data);
  } catch (error) {
    if (error.message === 'Worker not found') return res.status(404).json({ error: { message: error.message } });
    res.status(error.status || 502).json({ error: { message: error.message } });
  }
});

/**
 * GET /api/workers/:id
 * Get worker by ID
 * Protected route - requires authentication
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const worker = await WorkerService.getWorker(id);
    
    res.json({
      worker: {
        id: worker.id,
        hostname: worker.hostname,
        ip_address: worker.ip_address,
        status: worker.status,
        last_seen: worker.last_seen,
        resources: worker.resources,
        resourceRecords: worker.resourceRecords,
        projects: worker.projects || [],
        created_at: worker.created_at,
        updated_at: worker.updated_at,
        ...versionInfo(worker)
      }
    });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * POST /api/workers/:id/update
 * Ask a device to update to the latest published release ("Update now").
 * The device's updater sidecar picks this up on its next poll.
 * Protected route - requires authentication.
 */
router.post('/:id/update', authenticate, async (req, res, next) => {
  try {
    const worker = await WorkerService.getWorker(req.params.id);
    UpdateService.requestUpdate(worker.hostname);
    res.json({
      ok: true,
      worker_id: worker.id,
      hostname: worker.hostname,
      target_version: targetVersion(),
      message: 'Update requested; the device will pull and redeploy shortly.',
    });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }
    next(error);
  }
});

/**
 * GET /api/workers/:id/projects
 * Get all projects for a worker.
 * Worker-facing endpoint (polled by the agent with only its worker id, like
 * /:id/deployments and /:id/deployed-services), so it does not require a user
 * JWT. It only returns project metadata for an existing worker.
 */
router.get('/:id/projects', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verify worker exists
    const worker = await WorkerService.getWorker(id);
    if (!worker) {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }

    const projects = await WorkerService.getWorkerProjects(id);

    res.json({
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        enabled: p.enabled === 1,
        created_at: p.created_at,
        updated_at: p.updated_at
      }))
    });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * GET /api/workers/:id/deployments
 * Get pending deployment instructions for a worker (HTTP polling fallback)
 * Optional project_id query parameter to filter by project
 */
router.get('/:id/deployments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { project_id } = req.query;
    
    // Verify worker exists
    const worker = await WorkerService.getWorker(id);
    if (!worker) {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }

    // Get pending deployment instructions from ServiceManager
    const ServiceManager = require('../services/ServiceManager');
    const WorkerRepository = require('../repos/WorkerRepository');
    
    // Use singleton instance to access shared pending deployments
    const serviceManager = ServiceManager.getInstance(WorkerRepository);
    let instructions = serviceManager.getPendingDeployments(id);

    // Filter by project_id if provided
    if (project_id) {
      instructions = instructions.filter(inst => inst.project_id === project_id);
    }

    res.json({
      instructions: instructions
    });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * GET /api/workers/:id/deployed-services
 * Get list of services that should be running on this worker
 */
router.get('/:id/deployed-services', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verify worker exists
    const worker = await WorkerService.getWorker(id);
    if (!worker) {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }

    // Get deployed services for this worker
    // Filter by project_id if provided in query
    const { Service, ServiceDeployment } = require('../models');
    const deploymentWhere = { worker_id: id, status: 'deployed' };
    if (req.query.project_id) {
      deploymentWhere.project_id = req.query.project_id;
    }
    
    const deployments = await ServiceDeployment.findAll({
      where: deploymentWhere
    });

    const deployedServices = [];
    for (const deployment of deployments) {
      const services = await Service.findAll({
        where: { id: deployment.service_id }
      });
      if (services.length > 0) {
        const service = services[0];
        const serviceConfig = JSON.parse(service.config || '{}');
        deployedServices.push({
          name: service.name,
          docker_image: service.docker_image,
          project_id: deployment.project_id, // Include project_id at top level for easy access
          config: {
            ...serviceConfig
          }
        });
      }
    }

    res.json({
      services: deployedServices
    });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({
        error: {
          message: 'Worker not found',
          status: 404
        }
      });
    }
    next(error);
  }
});

module.exports = router;

