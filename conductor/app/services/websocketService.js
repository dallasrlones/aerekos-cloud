import { io } from 'socket.io-client';
import { getApiBaseUrl } from '../utils/api';

/**
 * WebSocket Service - Real-time communication with conductor
 */
class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.rooms = new Set();
    this.workers = new Set();
    this.isConnected = false;
  }

  /**
   * Connect to conductor WebSocket server
   * @param {string} token - JWT authentication token
   */
  connect(token) {
    if (this.socket?.connected) {
      this.isConnected = true;
      return;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }

    const baseURL = getApiBaseUrl();

    this.socket = io(`${baseURL}/frontend`, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      auth: {
        token: token
      }
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected to conductor');
      this.isConnected = true;
      this.rooms.forEach((room) => this.socket.emit('live:subscribe', { room }));
      this.workers.forEach((workerId) => this.socket.emit('worker:subscribe', { workerId }));
      this.emit('connected');
      this.emit('console:reconnected');
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from conductor');
      this.isConnected = false;
      this.emit('disconnected');
      this.emit('console:disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.isConnected = false;
    });

    this.socket.onAny((event, data) => {
      if (event === 'connect' || event === 'disconnect' || event === 'connect_error') return;
      this.emit(event, data);
    });
  }

  /**
   * Subscribe to live updates for a specific worker
   * @param {string} workerId - Worker ID to subscribe to
   */
  subscribeToWorker(workerId) {
    if (!workerId) return;
    this.workers.add(workerId);
    if (this.socket && this.socket.connected) {
      this.socket.emit('worker:subscribe', { workerId });
    }
  }

  /**
   * Unsubscribe from live updates for a specific worker
   * @param {string} workerId - Worker ID to unsubscribe from
   */
  unsubscribeFromWorker(workerId) {
    if (!workerId) return;
    this.workers.delete(workerId);
    if (this.socket && this.socket.connected) {
      this.socket.emit('worker:unsubscribe', { workerId });
    }
  }

  subscribeRoom(room, extra = {}) {
    if (!room) return;
    this.rooms.add(room);
    const m = /^ai:live:([0-9a-f-]{36})$/i.exec(room);
    const projectId = extra.projectId || extra.project_id || (m && m[1]);
    if (this.socket && this.socket.connected) {
      this.socket.emit('live:subscribe', { room, project_id: projectId });
    }
  }

  unsubscribeRoom(room) {
    if (!room) return;
    this.rooms.delete(room);
    if (this.socket && this.socket.connected) {
      this.socket.emit('live:unsubscribe', { room });
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
