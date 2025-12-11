const ConductorSocketService = require('../../api/services/ConductorSocketService');
const { io: Client } = require('socket.io-client');

// Mock socket.io-client
jest.mock('socket.io-client');

describe('ConductorSocketService Unit Tests', () => {
  let socketService;
  const conductorUrl = 'http://localhost:3000';
  let mockSocket;

  beforeEach(() => {
    socketService = new ConductorSocketService(conductorUrl);
    
    // Create mock socket
    mockSocket = {
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
      id: 'mock-socket-id'
    };

    // Mock Client to return our mock socket
    Client.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setOnReconnect', () => {
    test('should set reconnect callback', () => {
      const callback = jest.fn();
      
      socketService.setOnReconnect(callback);
      
      // Verify callback is stored
      expect(socketService.onReconnectCallback).toBe(callback);
    });

    test('should handle multiple reconnect callbacks (replace previous)', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      socketService.setOnReconnect(callback1);
      socketService.setOnReconnect(callback2);
      
      expect(socketService.onReconnectCallback).toBe(callback2);
      expect(socketService.onReconnectCallback).not.toBe(callback1);
    });
  });

  describe('connect', () => {
    test('should connect successfully', async () => {
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });

      await socketService.connect();

      expect(socketService.getIsConnected()).toBe(true);
    });

    test('should call reconnect callback on reconnect', async () => {
      const callback = jest.fn();
      socketService.setOnReconnect(callback);

      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'connect') {
          // First connect
          setTimeout(() => {
            handler();
            // Simulate reconnect
            socketService.workerId = 'worker-123';
            setTimeout(() => handler(), 10);
          }, 0);
        }
      });

      await socketService.connect();
      
      // Wait for reconnect callback
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callback).toHaveBeenCalled();
    });

    test('should handle connection errors after max attempts', async () => {
      socketService.maxReconnectAttempts = 2;
      socketService.reconnectAttempts = 0;
      
      let connectErrorHandler;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'connect_error') {
          connectErrorHandler = handler;
        }
      });

      // Simulate multiple connection errors
      const connectPromise = socketService.connect();
      
      // Trigger connect_error multiple times to exceed max attempts
      setTimeout(() => {
        if (connectErrorHandler) {
          connectErrorHandler(new Error('Connection failed'));
          connectErrorHandler(new Error('Connection failed'));
          connectErrorHandler(new Error('Connection failed'));
        }
      }, 10);

      await expect(connectPromise).rejects.toThrow();
    }, 20000);

    test('should handle disconnect', async () => {
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
        if (event === 'disconnect') {
          setTimeout(() => handler('io server disconnect'), 10);
        }
      });

      await socketService.connect();
      expect(socketService.getIsConnected()).toBe(true);

      // Wait for disconnect
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(socketService.getIsConnected()).toBe(false);
      expect(socketService.getWorkerId()).toBeNull();
    });
  });

  describe('registerWorker', () => {
    test('should register worker with existing worker ID', async () => {
      const mockWorkerResponse = {
        workerId: 'worker-123',
        hostname: 'test-worker',
        ip_address: '127.0.0.1',
        status: 'online'
      };
      
      const expectedWorker = {
        id: 'worker-123',
        hostname: 'test-worker',
        ip_address: '127.0.0.1',
        status: 'online'
      };

      // Mock socket events
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });

      mockSocket.once.mockImplementation((event, handler) => {
        if (event === 'worker:registered') {
          setTimeout(() => handler(mockWorkerResponse), 10);
        }
      });

      await socketService.connect();

      const result = await socketService.registerWorker(
        'test-token',
        'test-hostname',
        '127.0.0.1',
        { cpu_cores: 4 },
        'worker-123' // existing worker ID
      );

      expect(result).toEqual(expectedWorker);
      expect(socketService.getWorkerId()).toBe('worker-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('worker:register', {
        token: 'test-token',
        hostname: 'test-hostname',
        ip_address: '127.0.0.1',
        resources: { cpu_cores: 4 },
        worker_id: 'worker-123'
      });
    });

    test('should reject if not connected', async () => {
      await expect(
        socketService.registerWorker('token', 'hostname', '127.0.0.1', {})
      ).rejects.toThrow('Not connected to conductor');
    });

    test('should handle registration timeout', async () => {
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });

      mockSocket.once.mockImplementation(() => {
        // Don't call handler - simulate timeout
      });

      await socketService.connect();

      await expect(
        socketService.registerWorker('token', 'hostname', '127.0.0.1', {})
      ).rejects.toThrow('Registration timeout');
    });

    test('should handle registration error', async () => {
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });

      mockSocket.once.mockImplementation((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler({ message: 'Invalid token' }), 10);
        }
      });

      await socketService.connect();

      await expect(
        socketService.registerWorker('invalid-token', 'hostname', '127.0.0.1', {})
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('sendPing', () => {
    test('should send ping when connected and registered', () => {
      socketService.isConnected = true;
      socketService.workerId = 'worker-123';
      socketService.socket = mockSocket;

      socketService.sendPing({ cpu_cores: 4 });

      expect(mockSocket.emit).toHaveBeenCalledWith('worker:ping', {
        timestamp: expect.any(String),
        resources: { cpu_cores: 4 }
      });
    });

    test('should not send ping when not connected', () => {
      socketService.isConnected = false;
      socketService.workerId = 'worker-123';
      socketService.socket = mockSocket;

      socketService.sendPing({ cpu_cores: 4 });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('should not send ping when not registered', () => {
      socketService.isConnected = true;
      socketService.workerId = null;
      socketService.socket = mockSocket;

      socketService.sendPing({ cpu_cores: 4 });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('sendResources', () => {
    test('should send resources when connected and registered', () => {
      socketService.isConnected = true;
      socketService.workerId = 'worker-123';
      socketService.socket = mockSocket;

      socketService.sendResources({ cpu_cores: 8 });

      expect(mockSocket.emit).toHaveBeenCalledWith('worker:resources', {
        resources: { cpu_cores: 8 }
      });
    });

    test('should not send resources when not connected', () => {
      socketService.isConnected = false;
      socketService.workerId = 'worker-123';
      socketService.socket = mockSocket;

      socketService.sendResources({ cpu_cores: 8 });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    test('should disconnect socket', () => {
      socketService.socket = mockSocket;
      socketService.isConnected = true;
      socketService.workerId = 'worker-123';

      socketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(socketService.getIsConnected()).toBe(false);
      expect(socketService.getWorkerId()).toBeNull();
    });

    test('should handle disconnect when socket is null', () => {
      socketService.socket = null;

      expect(() => socketService.disconnect()).not.toThrow();
    });
  });
});

