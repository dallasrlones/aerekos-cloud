const { io: Client } = require('socket.io-client');
const hostPatch = require('../../utils/hostPatch');
const containerHost = require('./ContainerHostService');

/**
 * Conductor Socket Service - WebSocket client for real-time communication with conductor
 */
class ConductorSocketService {
  constructor(conductorUrl) {
    this.conductorUrl = conductorUrl;
    this.socket = null;
    this.workerId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity;
    this.reconnectDelay = 5000; // 5 seconds
    this.onReconnectCallback = null; // Callback to call on reconnect
    this.onDeploymentInstruction = null; // Callback for deployment instructions
    this.onOrphanCleanup = null; // Callback for orphan cleanup instructions
    this.projects = []; // Store assigned projects
  }

  /**
   * Set callback to be called when socket reconnects
   * @param {Function} callback - Callback function
   */
  setOnReconnect(callback) {
    this.onReconnectCallback = callback;
  }

  /**
   * Set callback to be called when workerId is set
   * @param {Function} callback - Callback function
   */
  setOnWorkerIdSet(callback) {
    this.onWorkerIdSet = callback;
  }

  /**
   * Set callback to be called when deployment instruction is received
   * @param {Function} callback - Callback function
   */
  setOnDeploymentInstruction(callback) {
    this.onDeploymentInstruction = callback;
  }

  /**
   * Set callback to be called when orphan cleanup instruction is received
   * @param {Function} callback - Callback function
   */
  setOnOrphanCleanup(callback) {
    this.onOrphanCleanup = callback;
  }

  /**
   * Connect to conductor WebSocket server
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.conductorUrl.replace(/^http/, 'ws');
      const wasConnected = this.isConnected;
      
      // If socket already exists, remove old listeners to avoid duplicates
      if (this.socket) {
        this.socket.removeAllListeners();
      }
      
      this.socket = Client(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts
      });

      let isFirstConnect = true;
      
      this.socket.on('connect', () => {
        console.log('[Socket] Connected to conductor');
        // Any 'connect' after the first is a reconnect. (Do NOT gate this on
        // workerId: the 'disconnect' handler clears workerId, so checking it here
        // would always be false and re-registration/heartbeat would never restart.)
        const isReconnect = !isFirstConnect;
        isFirstConnect = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // If this is a reconnect (was connected before), clear workerId and notify
        if (isReconnect) {
          console.log('[Socket] Reconnected - need to re-register worker');
          this.workerId = null;
          if (this.onReconnectCallback) {
            this.onReconnectCallback();
          }
        } else {
          // First connection - resolve the promise
          resolve();
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`[Socket] Disconnected from conductor: ${reason}`);
        this.isConnected = false;
        this.workerId = null; // Clear workerId on disconnect
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
        this.reconnectAttempts++;
        // Initial connect() must settle. Socket.IO still retries forever when
        // maxReconnectAttempts is Infinity; only the Promise rejects so boot can continue.
        const limit = Number.isFinite(this.maxReconnectAttempts) ? this.maxReconnectAttempts : 10;
        if (!this.isConnected && this.reconnectAttempts >= limit) {
          reject(error);
        }
      });

      this.socket.on('worker:registered', (data) => {
        this.workerId = data.workerId;
        console.log(`[Socket] Worker registered: ${data.workerId}`);
        // Notify callback if set (for syncing with ConductorService)
        if (this.onWorkerIdSet) {
          this.onWorkerIdSet(data.workerId);
        }
        // Store projects if provided in registration response
        if (data.projects) {
          this.projects = data.projects;
        }
      });

      this.socket.on('worker:pong', (data) => {
        // Heartbeat response received
      });

      this.socket.on('error', (error) => {
        console.error('[Socket] Error:', error);
      });

      // Listen for deployment instructions from conductor
      this.socket.on('deployment:instruction', (instruction) => {
        console.log(`[Socket] Received deployment instruction: ${instruction.action} for ${instruction.service}`);
        if (this.onDeploymentInstruction) {
          this.onDeploymentInstruction(instruction);
        }
      });

      // Listen for orphan cleanup instructions from conductor
      this.socket.on('orphan:cleanup', (cleanupData) => {
        console.log(`[Socket] Received orphan cleanup instruction for ${cleanupData.orphanedDeploymentIds?.length || 0} deployments`);
        if (this.onOrphanCleanup) {
          this.onOrphanCleanup(cleanupData);
        }
      });

      this.socket.on('host:check', async (data) => {
        const requestId = data?.requestId;
        try {
          const result = await hostPatch.probe();
          this.socket.emit('host:check:result', { requestId, ok: true, ...result });
        } catch (err) {
          this.socket.emit('host:check:result', {
            requestId,
            ok: false,
            error: err.message,
          });
        }
      });

      const emitContainer = async (event, data, fn) => {
        const requestId = data?.requestId;
        try {
          const result = await fn();
          this.socket.emit(`${event}:result`, { requestId, ok: true, ...result });
        } catch (err) {
          this.socket.emit(`${event}:result`, { requestId, ok: false, error: err.message });
        }
      };

      this.socket.on('containers:list', async (data) => {
        await emitContainer('containers:list', data, async () => ({
          containers: await containerHost.listContainers(),
        }));
      });
      this.socket.on('containers:start', async (data) => {
        await emitContainer('containers:start', data, async () => ({
          container: await containerHost.startContainer(data?.containerId),
        }));
      });
      this.socket.on('containers:stop', async (data) => {
        await emitContainer('containers:stop', data, async () => ({
          container: await containerHost.stopContainer(data?.containerId),
        }));
      });
      this.socket.on('containers:stats', async (data) => {
        await emitContainer('containers:stats', data, async () => ({
          stats: await containerHost.getStats(data?.containerId),
        }));
      });
      this.socket.on('containers:logs', async (data) => {
        await emitContainer('containers:logs', data, async () => ({
          logs: await containerHost.getLogs(data?.containerId, { tail: data?.tail }),
        }));
      });
      this.socket.on('containers:exec', async (data) => {
        await emitContainer('containers:exec', data, async () => (
          containerHost.execContainer(data?.containerId, data?.cmd, { tty: data?.tty })
        ));
      });
      this.socket.on('containers:inspect', async (data) => {
        await emitContainer('containers:inspect', data, async () => ({
          container: await containerHost.getContainer(data?.containerId || data?.name),
        }));
      });
      this.socket.on('containers:pull', async (data) => {
        await emitContainer('containers:pull', data, async () => (
          containerHost.ensureImage(data?.image)
        ));
      });
      this.socket.on('containers:create', async (data) => {
        await emitContainer('containers:create', data, async () => ({
          container: await containerHost.createAndStart(data?.spec || data || {}),
        }));
      });
      this.socket.on('containers:remove', async (data) => {
        await emitContainer('containers:remove', data, async () => {
          await containerHost.removeContainer(data?.containerId, { force: data?.force !== false });
          return { deleted: true };
        });
      });

      this.socket.on('host:update', async (data) => {
        const requestId = data?.requestId;
        const target = data?.target;
        try {
          const result = await hostPatch.update({ target });
          this.socket.emit('host:update:result', { requestId, ok: true, ...result });
        } catch (err) {
          this.socket.emit('host:update:result', {
            requestId,
            ok: false,
            error: err.message,
            target,
            reboot_required: err.reboot_required || false,
          });
        }
      });
    });
  }

  /**
   * Register worker via WebSocket
   * @param {string} token - Registration token
   * @param {string} hostname - Worker hostname
   * @param {string} ipAddress - Worker IP address
   * @param {object} resources - Initial resource information
   * @param {string} [existingWorkerId] - Optional existing worker ID to use
   * @param {Array<string>} [projectIds] - Optional array of project IDs to assign worker to
   * @returns {Promise<object>} Registered worker info with projects
   */
  async registerWorker(token, hostname, ipAddress, resources, existingWorkerId = null, projectIds = []) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to conductor'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Registration timeout'));
      }, 10000);

      this.socket.once('worker:registered', (data) => {
        clearTimeout(timeout);
        this.workerId = data.workerId;
        this.projects = data.projects || [];
        resolve({
          id: data.workerId,
          hostname: data.hostname,
          ip_address: data.ip_address,
          status: data.status,
          projects: data.projects || []
        });
      });

      this.socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message || 'Registration failed'));
      });

      this.socket.emit('worker:register', {
        token,
        hostname,
        ip_address: ipAddress,
        resources,
        worker_id: existingWorkerId, // Include existing worker ID if provided
        project_ids: projectIds // Include project IDs if provided
      });
    });
  }

  /**
   * Set callback for deployment instructions
   * @param {Function} callback - Callback function to handle deployment instructions
   */
  setOnDeploymentInstruction(callback) {
    this.onDeploymentInstruction = callback;
  }

  /**
   * Send heartbeat/ping with current resources
   * @param {object} resources - Current resource information
   */
  sendPing(resources) {
    if (this.isConnected && this.workerId) {
      this.socket.emit('worker:ping', { 
        timestamp: new Date().toISOString(),
        resources: resources || {}
      });
    }
  }

  /**
   * Send resource update
   * @param {object} resources - Resource information
   */
  sendResources(resources) {
    if (this.isConnected && this.workerId) {
      this.socket.emit('worker:resources', { resources });
    }
  }

  emitServiceHealth(event, payload) {
    if (this.isConnected && this.socket) {
      this.socket.emit('service:health', { event, ...payload, timestamp: new Date().toISOString() });
    }
  }

  /**
   * Disconnect from conductor
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      this.workerId = null;
    }
  }

  /**
   * Get worker ID
   * @returns {string|null} Worker ID or null if not registered
   */
  getWorkerId() {
    return this.workerId;
  }

  /**
   * Check if connected
   * @returns {boolean} True if connected
   */
  getIsConnected() {
    return this.isConnected;
  }
}

module.exports = ConductorSocketService;

