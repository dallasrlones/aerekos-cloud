const express = require('express');
const router = express.Router();
const WorkerService = require('../services/WorkerService');

/**
 * POST /api/workers/register
 * Register a new worker with the conductor
 * Requires registration token in request body
 */
router.post('/register', async (req, res, next) => {
  try {
    const { token, hostname, ip_address, resources, worker_id } = req.body;

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

    const worker = await WorkerService.registerWorker(token, workerHostname, workerIP, resources || {}, worker_id);
    
    res.status(201).json({
      worker: {
        id: worker.id,
        hostname: worker.hostname,
        ip_address: worker.ip_address,
        status: worker.status,
        last_seen: worker.last_seen,
        resources: worker.resources,
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
router.get('/', async (req, res, next) => {
  try {
    const workers = await WorkerService.getAllWorkers();
    
    res.json({
      workers: workers.map(worker => ({
        id: worker.id,
        hostname: worker.hostname,
        ip_address: worker.ip_address,
        status: worker.status,
        last_seen: worker.last_seen,
        resources: worker.resources,
        created_at: worker.created_at,
        updated_at: worker.updated_at
      }))
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
router.get('/:id', async (req, res, next) => {
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
        created_at: worker.created_at,
        updated_at: worker.updated_at
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

module.exports = router;

