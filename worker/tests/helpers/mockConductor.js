const express = require('express');

/**
 * Mock Conductor Server for Integration Tests
 */
class MockConductorServer {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    
    this.workers = new Map();
    this.registrationToken = 'test-registration-token';
    this.heartbeats = [];
    this.resourceUpdates = [];
    this.deploymentInstructions = [];
    
    this.setupRoutes();
    this.server = null;
  }

  setupRoutes() {
    // Trust proxy for accurate IP detection
    this.app.set('trust proxy', true);

    // Registration endpoint
    this.app.post('/api/workers/register', (req, res) => {
      const { token, resources, worker_id, hostname: bodyHostname, ip_address: bodyIp } = req.body;

      if (token !== this.registrationToken) {
        return res.status(401).json({
          error: { message: 'Invalid registration token', status: 401 }
        });
      }

      const ipAddress =
        bodyIp ||
        req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() ||
        req.ip ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        '127.0.0.1';

      const hostResolved =
        bodyHostname ||
        req.headers['x-forwarded-host'] ||
        req.headers['host']?.split(':')[0] ||
        req.hostname ||
        ipAddress;

      if (worker_id && this.workers.has(worker_id)) {
        const existing = this.workers.get(worker_id);
        if (resources) {
          existing.resources = resources;
        }
        existing.updated_at = new Date().toISOString();
        this.workers.set(worker_id, existing);
        return res.status(200).json({ worker: existing });
      }

      const newId = `worker-${Date.now()}`;
      const worker = {
        id: newId,
        hostname: hostResolved,
        ip_address: ipAddress,
        status: 'online',
        last_seen: new Date().toISOString(),
        resources: resources || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.workers.set(newId, worker);

      res.status(201).json({ worker });
    });

    // Heartbeat endpoint
    this.app.post('/api/workers/:id/heartbeat', (req, res) => {
      const { id } = req.params;
      const worker = this.workers.get(id);

      if (!worker) {
        return res.status(404).json({
          error: { message: 'Worker not found', status: 404 }
        });
      }

      worker.last_seen = new Date().toISOString();
      worker.status = 'online';
      this.heartbeats.push({ workerId: id, timestamp: worker.last_seen });

      res.json({ worker });
    });

    // Update resources endpoint
    this.app.put('/api/workers/:id/resources', (req, res) => {
      const { id } = req.params;
      const { resources } = req.body;
      const worker = this.workers.get(id);

      if (!worker) {
        return res.status(404).json({
          error: { message: 'Worker not found', status: 404 }
        });
      }

      worker.resources = resources;
      this.resourceUpdates.push({ workerId: id, resources, timestamp: new Date().toISOString() });

      res.json({ worker });
    });

    // Get deployment instructions endpoint
    this.app.get('/api/workers/:id/deployments', (req, res) => {
      const { id } = req.params;
      const worker = this.workers.get(id);

      if (!worker) {
        return res.status(404).json({
          error: { message: 'Worker not found', status: 404 }
        });
      }

      // Return pending deployment instructions
      const instructions = this.deploymentInstructions.filter(
        inst => inst.workerId === id && !inst.processed
      );

      res.json({ instructions });
    });

    // Service status reporting endpoint (placeholder)
    this.app.post('/api/workers/:id/services/:serviceName/status', (req, res) => {
      res.json({ success: true });
    });
  }

  async start(port = 3000) {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, '127.0.0.1', () => {
        console.log(`Mock conductor server started on port ${port}`);
        resolve();
      });
      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Try a different port.`);
          reject(err);
        } else {
          reject(err);
        }
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock conductor server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  addDeploymentInstruction(workerId, instruction) {
    this.deploymentInstructions.push({
      workerId,
      ...instruction,
      processed: false,
      timestamp: new Date().toISOString()
    });
  }

  getWorker(workerId) {
    return this.workers.get(workerId);
  }

  getHeartbeats() {
    return this.heartbeats;
  }

  getResourceUpdates() {
    return this.resourceUpdates;
  }
}

module.exports = MockConductorServer;

