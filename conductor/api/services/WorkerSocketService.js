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
          const { token, hostname, ip_address, resources } = data;
          
          if (!token) {
            socket.emit('error', { message: 'Registration token is required' });
            return;
          }

          // Register worker
          const worker = await WorkerService.registerWorker(
            token,
            hostname,
            ip_address,
            resources || {}
          );

          // Associate socket with worker
          this.workerSockets.set(worker.id, socket);
          this.socketWorkers.set(socket.id, worker.id);

          // Send registration success
          socket.emit('worker:registered', {
            workerId: worker.id,
            hostname: worker.hostname,
            ip_address: worker.ip_address,
            status: worker.status
          });

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
            await WorkerService.updateResources(workerId, {
              cpu_cores: resources.cpu_cores,
              ram_gb: resources.ram_gb,
              disk_gb: resources.disk_gb,
              network_mbps: resources.network_mbps
            });
            
            // Broadcast resource update to frontend clients (all)
            this.io.to('frontend').emit('worker:resources:updated', {
              workerId,
              resources: {
                cpu_cores: resources.cpu_cores,
                ram_gb: resources.ram_gb,
                disk_gb: resources.disk_gb,
                network_mbps: resources.network_mbps,
                cpu: resources.cpu,
                ram: resources.ram,
                disk: resources.disk,
                network: resources.network
              },
              timestamp: resources.timestamp || new Date().toISOString()
            });

            // Also emit to worker-specific room for live view (detailed metrics)
            this.io.to(`worker:${workerId}`).emit('worker:live:update', {
              workerId,
              resources: {
                cpu: resources.cpu,
                ram: resources.ram,
                disk: resources.disk,
                network: resources.network
              },
              timestamp: resources.timestamp || new Date().toISOString()
            });

            // Also emit to worker-specific room for live view
            this.io.to(`worker:${workerId}`).emit('worker:live:update', {
              workerId,
              resources: {
                cpu: resources.cpu,
                ram: resources.ram,
                disk: resources.disk,
                network: resources.network
              },
              timestamp: resources.timestamp || new Date().toISOString()
            });
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
          this.io.to('frontend').emit('worker:resources:updated', {
            workerId,
            resources
          });
        } catch (error) {
          console.error(`[Socket] Resource update error for worker ${workerId}:`, error.message);
          socket.emit('error', { message: error.message });
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
            
            // Notify frontend clients
            this.io.to('frontend').emit('worker:offline', {
              workerId,
              timestamp: new Date().toISOString()
            });
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
            
            // Notify frontend clients
            this.io.to('frontend').emit('worker:offline', {
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
              this.io.to('frontend').emit('worker:offline', {
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
   * Broadcast to all frontend clients
   * @param {string} event - Event name
   * @param {object} data - Data to send
   */
  broadcastToFrontend(event, data) {
    if (this.io) {
      this.io.to('frontend').emit(event, data);
    }
  }
}

module.exports = new WorkerSocketService();

