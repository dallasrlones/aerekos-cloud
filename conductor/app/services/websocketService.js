import { io } from 'socket.io-client';

/**
 * WebSocket Service - Real-time communication with conductor
 */
class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  /**
   * Connect to conductor WebSocket server
   * @param {string} token - JWT authentication token
   */
  connect(token) {
    if (this.socket && this.isConnected) {
      return;
    }

    // Get API base URL - use same logic as api.js
    const getApiBaseUrl = () => {
      if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
      }
      if (typeof window !== 'undefined' && window.location) {
        return 'http://localhost:3000';
      }
      return 'http://localhost:3000';
    };

    const baseURL = getApiBaseUrl();
    const wsURL = baseURL.replace(/^http/, 'ws');

    this.socket = io(`${wsURL}/frontend`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      auth: {
        token: token
      }
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected to conductor');
      this.isConnected = true;
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from conductor');
      this.isConnected = false;
      this.emit('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.isConnected = false;
    });

    // Listen for worker events
    this.socket.on('worker:online', (data) => {
      this.emit('worker:online', data);
    });

    this.socket.on('worker:offline', (data) => {
      this.emit('worker:offline', data);
    });

    this.socket.on('worker:resources:updated', (data) => {
      this.emit('worker:resources:updated', data);
    });

    // Listen for live worker updates (for device details screen)
    this.socket.on('worker:live:update', (data) => {
      this.emit('worker:live:update', data);
    });
  }

  /**
   * Subscribe to live updates for a specific worker
   * @param {string} workerId - Worker ID to subscribe to
   */
  subscribeToWorker(workerId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('worker:subscribe', { workerId });
    }
  }

  /**
   * Unsubscribe from live updates for a specific worker
   * @param {string} workerId - Worker ID to unsubscribe from
   */
  unsubscribeFromWorker(workerId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('worker:unsubscribe', { workerId });
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Error in callback for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check if connected
   * @returns {boolean} True if connected
   */
  getIsConnected() {
    return this.isConnected;
  }
}

export default new WebSocketService();

