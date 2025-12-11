const { io: Client } = require('socket.io-client');

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
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
  }

  /**
   * Connect to conductor WebSocket server
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.conductorUrl.replace(/^http/, 'ws');
      this.socket = Client(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected to conductor');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`[Socket] Disconnected from conductor: ${reason}`);
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(error);
        }
      });

      this.socket.on('worker:registered', (data) => {
        this.workerId = data.workerId;
        console.log(`[Socket] Worker registered: ${data.workerId}`);
      });

      this.socket.on('worker:pong', (data) => {
        // Heartbeat response received
      });

      this.socket.on('error', (error) => {
        console.error('[Socket] Error:', error);
      });
    });
  }

  /**
   * Register worker via WebSocket
   * @param {string} token - Registration token
   * @param {string} hostname - Worker hostname
   * @param {string} ipAddress - Worker IP address
   * @param {object} resources - Initial resource information
   * @returns {Promise<object>} Registered worker info
   */
  async registerWorker(token, hostname, ipAddress, resources) {
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
        resolve({
          id: data.workerId,
          hostname: data.hostname,
          ip_address: data.ip_address,
          status: data.status
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
        resources
      });
    });
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

