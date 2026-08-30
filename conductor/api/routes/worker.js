const express = require('express');
const router = express.Router();
const WorkerService = require('../services/WorkerService');
const ProjectService = require('../services/ProjectService');
const authenticate = require('../middleware/auth');
const { versionInfo, targetVersion } = require('../utils/version');
const UpdateService = require('../services/UpdateService');
const HostService = require('../services/HostService');
const ContainerService = require('../services/ContainerService');

function parseCaps(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const { inferRoles } = require('../services/deviceRoles');

function publicWorker(worker, extra = {}) {
  return {
    id: worker.id,
    hostname: worker.hostname,
    ip_address: worker.ip_address,
    status: worker.status,
    last_seen: worker.last_seen,
    resources: worker.resources,
    env: worker.env == null || worker.env === '' ? null : worker.env,
    capabilities: parseCaps(worker.capabilities),
    roles: inferRoles(worker),
    projects: worker.projects || [],
    vpc_id: worker.vpc_id || 'fleet',
    overlay_dns: `${String(worker.hostname || 'worker').split('.')[0]}.aerekos.internal`,
    created_at: worker.created_at,
    updated_at: worker.updated_at,
    ...extra
  };
}

/**
 * POST /api/workers/register
 * Register a new worker with the conductor
 * Requires registration token in request body
 */
router.post('/register', async (req, res, next) => {
  try {
    const { token, hostname, ip_address, resources, worker_id, project_ids, env, capabilities } = req.body;

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
      project_ids || [],
      { env, capabilities }
    );
    
    res.status(201).json({
      worker: publicWorker(worker)
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

router.get('/vpcs', authenticate, async (req, res) => {
  res.json({ vpcs: WorkerService.listVpcs() });
});

router.patch('/:id/vpc', authenticate, async (req, res, next) => {
  try {
    const vpcId = String(req.body?.vpc_id || '').trim();
    if (!vpcId) {
      return res.status(400).json({ error: { message: 'vpc_id required', status: 400 } });
    }
    const worker = await WorkerService.moveToVpc(req.params.id, vpcId);
    res.json({ worker: publicWorker(worker) });
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: { message: error.message, status: 400 } });
    }
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    res.json(await WorkerService.deregister(req.params.id));
  } catch (error) {
    if (error.message === 'Worker not found') {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
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
      workers: workers.map(worker => publicWorker(worker, versionInfo(worker, baseline)))
    });
  } catch (error) {
    next(error);
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
      worker: publicWorker(worker, {
        resourceRecords: worker.resourceRecords,
        ...versionInfo(worker)
      })
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

function hostError(res, next, error) {
  if (error.message === 'Worker not found') {
    return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
  }
  if (error.status === 400 || error.status === 503 || error.status === 504) {
    return res.status(error.status).json({ error: { message: error.message, status: error.status } });
  }
  return next(error);
}

/**
 * GET /api/workers/:id/host/check
 * Live host OS/Docker patch check via the worker socket.
 */
router.get('/:id/host/check', authenticate, async (req, res, next) => {
  try {
    const result = await HostService.check(req.params.id);
    res.json(result);
  } catch (error) {
    hostError(res, next, error);
  }
});

/**
 * POST /api/workers/:id/host/check
 * Same as GET — live probe, never applies updates.
 */
router.post('/:id/host/check', authenticate, async (req, res, next) => {
  try {
    const result = await HostService.check(req.params.id);
    res.json(result);
  } catch (error) {
    hostError(res, next, error);
  }
});

/**
 * POST /api/workers/:id/host/update
 * Apply host OS or Docker package updates on the device (operator-initiated).
 * Body: { target: 'os' | 'docker' }
 */
router.post('/:id/host/update', authenticate, async (req, res, next) => {
  try {
    const result = await HostService.update(req.params.id, req.body?.target, {
      actorId: req.userId,
      ip: req.ip,
    });
    res.json(result);
  } catch (error) {
    hostError(res, next, error);
  }
});

function containerError(res, next, error) {
  if (error.status === 400 || error.status === 404 || error.status === 503 || error.status === 504) {
    return res.status(error.status).json({ error: { message: error.message, status: error.status } });
  }
  return next(error);
}

/**
 * GET /api/workers/:id/containers
 * Host Docker containers on this worker (Device Details → Data).
 */
router.get('/:id/containers', authenticate, async (req, res, next) => {
  try {
    res.json(await ContainerService.list(req.params.id));
  } catch (error) {
    containerError(res, next, error);
  }
});

router.post('/:id/containers/:cid/start', authenticate, async (req, res, next) => {
  try {
    res.json(await ContainerService.start(req.params.id, req.params.cid));
  } catch (error) {
    containerError(res, next, error);
  }
});

router.post('/:id/containers/:cid/stop', authenticate, async (req, res, next) => {
  try {
    res.json(await ContainerService.stop(req.params.id, req.params.cid));
  } catch (error) {
    containerError(res, next, error);
  }
});

router.get('/:id/containers/:cid/logs', authenticate, async (req, res, next) => {
  try {
    res.json(await ContainerService.logs(req.params.id, req.params.cid, req.query.tail));
  } catch (error) {
    containerError(res, next, error);
  }
});

router.post('/:id/containers/:cid/exec', authenticate, async (req, res, next) => {
  try {
    res.json(await ContainerService.exec(req.params.id, req.params.cid, req.body?.cmd, req.body?.tty));
  } catch (error) {
    containerError(res, next, error);
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

