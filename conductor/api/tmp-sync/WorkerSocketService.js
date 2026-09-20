const { Server } = require('socket.io');
const WorkerService = require('./WorkerService');
const WorkerRepository = require('../repos/WorkerRepository');

/**
 * Worker Socket Service - Manages WebSocket connections for real-time worker monitoring
 */
class WorkerSocketService {
  constructor() {
    this.io = null;
    this.workerSockets = new Map(); // Map of workerId -> socket
    this.socketWorkers = new Map(); // Map of socketId -> workerId
    this.workerLastHeartbeat = new Map(); // Map of workerId -> last heartbeat timestamp
    this.heartbeatTimeout = 60 * 1000; // 60 seconds timeout
    this.heartbeatCheckInterval = null;
  }

  /**
   * Initialize Socket.IO server
   * @param {http.Server} httpServer - HTTP server instance
   */
  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      // Handle worker registration via socket
      socket.on('worker:register', async (data) => {
        try {
          const { token, hostname, ip_address, resources, worker_id, project_ids, env, capabilities } = data;
          
          if (!token) {
            socket.emit('error', { message: 'Registration token is required' });
            return;
          }

          // Register worker (pass existing worker_id and project_ids if provided)
          const worker = await WorkerService.registerWorker(
            token,
            hostname,
            ip_address,
            resources || {},
            worker_id || null,
            project_ids || [],
            { env, capabilities }
          );

          // Associate socket with worker
          this.workerSockets.set(worker.id, socket);
          this.socketWorkers.set(socket.id, worker.id);

          // Get projects for worker (worker.projects should already be populated by WorkerService)
          const projects = worker.projects || [];
          
          // Send registration success with projects
          socket.emit('worker:registered', {
            workerId: worker.id,
            hostname: worker.hostname,
            ip_address: worker.ip_address,
            status: worker.status,
            projects: projects.map(p => ({ id: p.id, name: p.name }))
          });
          
          console.log(`[Socket] Worker ${worker.id} assigned to ${projects.length} project(s)`);

          // Join worker-specific room
          socket.join(`worker:${worker.id}`);

          console.log(`[Socket] Worker registered: ${worker.id} (${worker.hostname})`);
        } catch (error) {
          console.error(`[Socket] Registration error:`, error.message);
          socket.emit('error', { message: error.message });
        }
      });

      // Handle heartbeat/ping (with real-time resources)
      socket.on('worker:ping', async (data) => {
        const workerId = this.socketWorkers.get(socket.id);
        if (!workerId) {
          socket.emit('error', { message: 'Worker not registered' });
          return;
        }

        try {
          // Update last heartbeat timestamp
          this.workerLastHeartbeat.set(workerId, Date.now());
          
          // Update last_seen and status
          await WorkerService.sendHeartbeat(workerId);
          
          // Update resources if provided in heartbeat
          if (data.resources) {
            const { resources } = data;
            await WorkerService.updateResources(workerId, resources);
            this.sampleHostMetrics(workerId, resources).catch(() => {});
            
            // Broadcast resource update to frontend clients (all)
            this.io.of('/frontend').to('frontend').emit('worker:resources:updated', {
              workerId,
              resources: {
                cpu_cores: resources.cpu_cores,
                ram_gb: resources.ram_gb,
                disk_gb: resources.disk_gb,
                network_mbps: resources.network_mbps,
                cpu: resources.cpu,
                ram: resources.ram,
                disk: resources.disk,
                network: resources.network,
                processes: resources.processes,
                gpu: resources.gpu,
                docker: resources.docker,
                loaded_ai: resources.loaded_ai,
                host: resources.host
              },
              timestamp: resources.timestamp || new Date().toISOString()
            });

            // Also emit to worker-specific room for live view (detailed metrics)
            // Emit to /frontend namespace where frontend clients are connected
            const liveUpdateData = {
              workerId,
              resources: {
                cpu: resources.cpu,
                ram: resources.ram,
                disk: resources.disk,
                network: resources.network,
                processes: resources.processes,
                gpu: resources.gpu,
                docker: resources.docker,
                loaded_ai: resources.loaded_ai,
                host: resources.host
              },
              timestamp: resources.timestamp || new Date().toISOString()
            };
            console.log(`[Socket] Emitting worker:live:update to worker:${workerId} room in /frontend namespace`);
            this.io.of('/frontend').to(`worker:${workerId}`).emit('worker:live:update', liveUpdateData);
          }
          
          socket.emit('worker:pong', { timestamp: new Date().toISOString() });
        } catch (error) {
          console.error(`[Socket] Heartbeat error for worker ${workerId}:`, error.message);
          socket.emit('error', { message: error.message });
        }
      });

      // Handle resource updates
      socket.on('worker:resources', async (data) => {
        const workerId = this.socketWorkers.get(socket.id);
        if (!workerId) {
          socket.emit('error', { message: 'Worker not registered' });
          return;
        }

        try {
          const { resources } = data;
          await WorkerService.updateResources(workerId, resources);
          
          // Broadcast resource update to frontend clients
          this.io.of('/frontend').to('frontend').emit('worker:resources:updated', {
            workerId,
            resources
          });
        } catch (error) {
          console.error(`[Socket] Resource update error for worker ${workerId}:`, error.message);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('service:health', (data) => {
        const event = data?.event || 'service:unhealthy';
        const payload = {
          service: data.service,
          workerId: workerId || data.workerId,
          hostname: data.hostname,
          projectId: data.projectId,
          timestamp: data.timestamp || new Date().toISOString(),
        };
        if (this.io) {
          this.io.of('/frontend').to('frontend').emit(event, payload);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        const workerId = this.socketWorkers.get(socket.id);
        
        if (workerId) {
          console.log(`[Socket] Worker disconnected: ${workerId}`);
          
          try {
            // Mark worker as offline instantly
            await WorkerService.markWorkerOffline(workerId);

            // Notify frontend clients (io may be torn down during tests / shutdown)
            if (this.io) {
              this.io.of('/frontend').to('frontend').emit('worker:offline', {
                workerId,
                timestamp: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error(`[Socket] Error marking worker offline:`, error.message);
          }

          // Clean up mappings
          this.workerSockets.delete(workerId);
          this.socketWorkers.delete(socket.id);
          this.workerLastHeartbeat.delete(workerId);
        } else {
          console.log(`[Socket] Client disconnected: ${socket.id}`);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`[Socket] Socket error:`, error);
      });
    });

    // Namespace for frontend clients
    this.io.of('/frontend').on('connection', (socket) => {
      console.log(`[Socket] Frontend client connected: ${socket.id}`);
      socket.join('frontend');

      // Handle subscription to live worker updates
      socket.on('worker:subscribe', (data) => {
        const { workerId } = data;
        if (workerId) {
          socket.join(`worker:${workerId}`);
          console.log(`[Socket] Frontend client ${socket.id} subscribed to worker ${workerId}`);
        }
      });

      // Handle unsubscription from live worker updates
      socket.on('worker:unsubscribe', (data) => {
        const { workerId } = data;
        if (workerId) {
          socket.leave(`worker:${workerId}`);
          console.log(`[Socket] Frontend client ${socket.id} unsubscribed from worker ${workerId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Frontend client disconnected: ${socket.id}`);
      });
    });

    // Start heartbeat timeout check
    this.startHeartbeatTimeoutCheck();

    console.log('[Socket] WebSocket server initialized');
  }

  /**
   * Start periodic check for workers that haven't sent heartbeat
   */
  startHeartbeatTimeoutCheck() {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
    }

    // Check every 30 seconds for workers that haven't sent heartbeat
    this.heartbeatCheckInterval = setInterval(async () => {
      const now = Date.now();
      
      // Check workers tracked in memory (connected via WebSocket)
      const workersToCheck = Array.from(this.workerLastHeartbeat.entries());
      for (const [workerId, lastHeartbeat] of workersToCheck) {
        const timeSinceLastHeartbeat = now - lastHeartbeat;
        
        if (timeSinceLastHeartbeat > this.heartbeatTimeout) {
          console.log(`[Socket] Worker ${workerId} heartbeat timeout (${Math.round(timeSinceLastHeartbeat / 1000)}s since last heartbeat)`);
          
          try {
            // Mark worker as offline
            await WorkerService.markWorkerOffline(workerId);
            try {
              const { notify } = require('./AlertFanout');
              await notify(process.env.DEFAULT_PROJECT_ID, {
                title: 'Worker down',
                body: `Worker ${workerId} heartbeat timeout`,
                severity: 'error',
              });
            } catch (_) { /* best-effort */ }

            // Notify frontend clients
            this.io.of('/frontend').to('frontend').emit('worker:offline', {
              workerId,
              timestamp: new Date().toISOString(),
              reason: 'heartbeat_timeout'
            });

            // Clean up mappings (socket might still be connected but not sending heartbeats)
            this.workerSockets.delete(workerId);
            this.workerLastHeartbeat.delete(workerId);
            
            // Find and remove socket mapping
            for (const [socketId, mappedWorkerId] of this.socketWorkers.entries()) {
              if (mappedWorkerId === workerId) {
                this.socketWorkers.delete(socketId);
                break;
              }
            }
          } catch (error) {
            console.error(`[Socket] Error marking worker ${workerId} offline due to timeout:`, error.message);
          }
        }
      }

      // Also check all workers in database (for workers that were online but server restarted)
      try {
        const allWorkers = await WorkerService.getAllWorkers();
        for (const worker of allWorkers) {
          // Skip if worker is already tracked in memory (handled above)
          if (this.workerLastHeartbeat.has(worker.id)) {
            continue;
          }

          // If worker is marked as online but hasn't sent heartbeat recently
          if (worker.status === 'online' && worker.last_seen) {
            const lastSeen = new Date(worker.last_seen).getTime();
            const timeSinceLastSeen = now - lastSeen;
            
            // If last_seen is more than 90 seconds ago (60s timeout + 30s buffer), mark offline
            if (timeSinceLastSeen > 90000) {
              console.log(`[Socket] Worker ${worker.id} marked offline (no heartbeat for ${Math.round(timeSinceLastSeen / 1000)}s)`);
              await WorkerService.markWorkerOffline(worker.id);
              
              // Notify frontend clients
              this.io.of('/frontend').to('frontend').emit('worker:offline', {
                workerId: worker.id,
                timestamp: new Date().toISOString(),
                reason: 'database_timeout'
              });
            }
          }
        }
      } catch (error) {
        console.error(`[Socket] Error checking database workers:`, error.message);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get Socket.IO instance
   * @returns {Server} Socket.IO server instance
   */
  getIO() {
    return this.io;
  }

  /**
   * Check if worker is connected
   * @param {string} workerId - Worker ID
   * @returns {boolean} True if worker is connected
   */
  isWorkerConnected(workerId) {
    return this.workerSockets.has(workerId);
  }

  /**
   * Send message to specific worker
   * @param {string} workerId - Worker ID
   * @param {string} event - Event name
   * @param {object} data - Data to send
   */
  sendToWorker(workerId, event, data) {
    const socket = this.workerSockets.get(workerId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  /**
   * Request/response over the worker socket. Emits `event` and waits for
   * `replyEvent` with a matching requestId.
   * @param {string} workerId
   * @param {string} event
   * @param {object} data
   * @param {string} replyEvent
   * @param {number} [timeoutMs]
   * @returns {Promise<object>}
   */
  requestFromWorker(workerId, event, data = {}, replyEvent, timeoutMs = 60000) {
    const socket = this.workerSockets.get(workerId);
    if (!socket) {
      const err = new Error('Worker is offline');
      err.status = 503;
      return Promise.reject(err);
    }

    const crypto = require('crypto');
    const requestId = data.requestId || crypto.randomUUID();
    const payload = { ...data, requestId };

    return new Promise((resolve, reject) => {
      const onReply = (reply) => {
        if (!reply || reply.requestId !== requestId) return;
        cleanup();
        resolve(reply);
      };
      const onDisconnect = () => {
        cleanup();
        const err = new Error('Worker disconnected');
        err.status = 503;
        reject(err);
      };
      const timer = setTimeout(() => {
        cleanup();
        const err = new Error('Worker request timed out');
        err.status = 504;
        reject(err);
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        socket.off(replyEvent, onReply);
        socket.off('disconnect', onDisconnect);
      };
      socket.on(replyEvent, onReply);
      socket.once('disconnect', onDisconnect);
      socket.emit(event, payload);
    });
  }

  /**
   * Send deployment instruction to worker via WebSocket
   * @param {string} workerId - Worker ID
   * @param {object} instruction - Deployment instruction
   * @returns {boolean} True if sent successfully, false if worker not connected
   */
  sendDeploymentInstruction(workerId, instruction) {
    const socket = this.workerSockets.get(workerId);
    if (socket) {
      socket.emit('deployment:instruction', instruction);
      console.log(`[Socket] Sent deployment instruction to worker ${workerId}: ${instruction.action} for ${instruction.service}`);
      return true;
    }
    return false;
  }

  /**
   * Send orphan cleanup instruction to worker via WebSocket
   * @param {string} workerId - Worker ID
   * @param {object} cleanupData - Cleanup data (orphanedDeploymentIds, projectName)
   * @returns {boolean} True if sent successfully, false if worker not connected
   */
  sendOrphanCleanupInstruction(workerId, cleanupData) {
    const socket = this.workerSockets.get(workerId);
    if (socket) {
      socket.emit('orphan:cleanup', cleanupData);
      console.log(`[Socket] Sent orphan cleanup instruction to worker ${workerId} for ${cleanupData.orphanedDeploymentIds?.length || 0} deployments`);
      return true;
    }
    return false;
  }

  /**
   * Broadcast to all frontend clients
   * @param {string} event - Event name
   * @param {object} data - Data to send
   */
  broadcastToFrontend(event, data) {
    if (this.io) {
      this.io.of('/frontend').to('frontend').emit(event, data);
    }
  }

  async sampleHostMetrics(workerId, resources = {}) {
    const projectId = process.env.DEFAULT_PROJECT_ID || process.env.SYSTEM_PROJECT_ID || '9d8bde11-6933-4732-b746-602dcf72eaa5';
    if (!projectId) return;
    const ramPct = Number(resources.ram?.usagePercent || 0);
    const oom = (resources.docker || []).some((c) => c.oom) ? 1 : 0;
    const port = process.env.PORT || 3300;
    const base = (process.env.CONDUCTOR_INTERNAL_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
    const axios = require('axios');
    const headers = { 'x-project-id': projectId, 'Content-Type': 'application/json' };
    await axios.post(`${base}/api/services/metrics_manager/api/v1/series/sample`, {
      project_id: projectId,
      name: `host.ram.pct/${workerId}`,
      metric_name: 'host.ram.pct',
      value: String(ramPct),
      labels: { worker_id: workerId },
    }, { headers, timeout: 4000, validateStatus: () => true });
    await axios.post(`${base}/api/services/metrics_manager/api/v1/series/sample`, {
      project_id: projectId,
      name: `compute.oom/${workerId}`,
      metric_name: 'compute.oom',
      value: String(oom),
      labels: { worker_id: workerId },
    }, { headers, timeout: 4000, validateStatus: () => true });
    if (ramPct > 90 || oom) {
      await axios.post(`${base}/api/services/metrics_manager/api/v1/alarms/evaluate`, {
        project_id: projectId,
        metric_name: ramPct > 90 ? 'host.ram.pct' : 'compute.oom',
        value: ramPct > 90 ? ramPct : oom,
      }, { headers, timeout: 4000, validateStatus: () => true });
    }
  }
}

module.exports = new WorkerSocketService();

