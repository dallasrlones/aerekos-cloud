const ConductorService = require('../../api/services/ConductorService');
const axios = require('axios');
const { mockAxiosResponse, mockAxiosError } = require('../helpers/testHelpers');

// Mock axios
jest.mock('axios');

describe('ConductorService Unit Tests', () => {
  let conductorService;
  const conductorUrl = 'http://localhost:3000';

  beforeEach(() => {
    conductorService = new ConductorService(conductorUrl);
    jest.clearAllMocks();
  });

  describe('registerWorker', () => {
    test('should register worker successfully', async () => {
      const mockWorker = {
        id: 'worker-123',
        hostname: 'test-worker',
        ip_address: '127.0.0.1',
        status: 'online'
      };

      axios.post.mockResolvedValue(mockAxiosResponse({ worker: mockWorker }));

      const result = await conductorService.registerWorker(
        'test-token',
        'test-hostname',
        '127.0.0.1',
        { cpu_cores: 4, ram_gb: 8 }
      );

      expect(result).toEqual(mockWorker);
      expect(conductorService.getWorkerId()).toBe('worker-123');
      expect(axios.post).toHaveBeenCalledWith(
        `${conductorUrl}/api/workers/register`,
        {
          token: 'test-token',
          hostname: 'test-hostname',
          ip_address: '127.0.0.1',
          resources: { cpu_cores: 4, ram_gb: 8 },
          worker_id: null
        }
      );
    });

    test('should handle registration errors', async () => {
      axios.post.mockRejectedValue(mockAxiosError('Invalid token', 401));

      await expect(
        conductorService.registerWorker('invalid-token', 'hostname', '127.0.0.1', {})
      ).rejects.toThrow('Invalid token');
    });

    test('should handle connection errors', async () => {
      axios.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        conductorService.registerWorker('test-token', 'hostname', '127.0.0.1', {})
      ).rejects.toThrow('Failed to connect to conductor');
    });
  });

  describe('sendHeartbeat', () => {
    test('should send heartbeat successfully', async () => {
      conductorService.setWorkerId('worker-123');
      const mockWorker = {
        id: 'worker-123',
        status: 'online',
        last_seen: new Date().toISOString()
      };

      axios.post.mockResolvedValue(mockAxiosResponse({ worker: mockWorker }));

      const result = await conductorService.sendHeartbeat();

      expect(result).toEqual(mockWorker);
      expect(axios.post).toHaveBeenCalledWith(
        `${conductorUrl}/api/workers/worker-123/heartbeat`
      );
    });

    test('should throw error if worker not registered', async () => {
      await expect(conductorService.sendHeartbeat()).rejects.toThrow('Worker not registered');
    });

    test('should handle 404 and trigger re-registration', async () => {
      conductorService.setWorkerId('worker-123');
      axios.post.mockRejectedValue(mockAxiosError('Worker not found', 404));

      await expect(conductorService.sendHeartbeat()).rejects.toThrow('re-registration required');
      expect(conductorService.getWorkerId()).toBeNull();
    });
  });

  describe('updateResources', () => {
    test('should update resources successfully', async () => {
      conductorService.setWorkerId('worker-123');
      const mockWorker = {
        id: 'worker-123',
        resources: { cpu_cores: 8, ram_gb: 16 }
      };

      axios.put.mockResolvedValue(mockAxiosResponse({ worker: mockWorker }));

      const result = await conductorService.updateResources({
        cpu_cores: 8,
        ram_gb: 16
      });

      expect(result).toEqual(mockWorker);
      expect(axios.put).toHaveBeenCalledWith(
        `${conductorUrl}/api/workers/worker-123/resources`,
        {
          resources: { cpu_cores: 8, ram_gb: 16 }
        }
      );
    });

    test('should throw error if worker not registered', async () => {
      await expect(
        conductorService.updateResources({ cpu_cores: 4 })
      ).rejects.toThrow('Worker not registered');
    });
  });

  describe('getWorkerId', () => {
    test('should return null initially', () => {
      expect(conductorService.getWorkerId()).toBeNull();
    });

    test('should return worker ID after registration', () => {
      conductorService.setWorkerId('worker-123');
      expect(conductorService.getWorkerId()).toBe('worker-123');
    });
  });

  describe('verifyWorkerId', () => {
    test('should return true when worker ID is valid', async () => {
      axios.post.mockResolvedValue(mockAxiosResponse({ valid: true }));

      const result = await conductorService.verifyWorkerId('worker-123', 'test-token');

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        `${conductorUrl}/api/workers/verify`,
        {
          worker_id: 'worker-123',
          token: 'test-token'
        }
      );
    });

    test('should return false when worker ID is not found (404)', async () => {
      axios.post.mockRejectedValue(mockAxiosError('Worker not found', 404));

      const result = await conductorService.verifyWorkerId('invalid-worker', 'test-token');

      expect(result).toBe(false);
    });

    test('should return false on other errors', async () => {
      axios.post.mockRejectedValue(mockAxiosError('Server error', 500));

      const result = await conductorService.verifyWorkerId('worker-123', 'test-token');

      expect(result).toBe(false);
    });

    test('should return false on connection errors', async () => {
      axios.post.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await conductorService.verifyWorkerId('worker-123', 'test-token');

      expect(result).toBe(false);
    });
  });

  describe('registerWorker with existingWorkerId', () => {
    test('should register worker with existing worker ID', async () => {
      const mockWorker = {
        id: 'worker-123',
        hostname: 'test-worker',
        ip_address: '127.0.0.1',
        status: 'online'
      };

      axios.post.mockResolvedValue(mockAxiosResponse({ worker: mockWorker }));

      const result = await conductorService.registerWorker(
        'test-token',
        'test-hostname',
        '127.0.0.1',
        { cpu_cores: 4, ram_gb: 8 },
        'worker-123' // existing worker ID
      );

      expect(result).toEqual(mockWorker);
      expect(conductorService.getWorkerId()).toBe('worker-123');
      expect(axios.post).toHaveBeenCalledWith(
        `${conductorUrl}/api/workers/register`,
        {
          token: 'test-token',
          hostname: 'test-hostname',
          ip_address: '127.0.0.1',
          resources: { cpu_cores: 4, ram_gb: 8 },
          worker_id: 'worker-123'
        }
      );
    });

    test('should handle registration error with response data', async () => {
      axios.post.mockRejectedValue(mockAxiosError('Invalid token', 401));

      await expect(
        conductorService.registerWorker('invalid-token', 'hostname', '127.0.0.1', {})
      ).rejects.toThrow('Invalid token');
    });

    test('should handle registration error without response data', async () => {
      axios.post.mockRejectedValue(mockAxiosError('Registration failed', 500));

      await expect(
        conductorService.registerWorker('test-token', 'hostname', '127.0.0.1', {})
      ).rejects.toThrow('Registration failed');
    });
  });

  describe('sendHeartbeat error handling', () => {
    test('should handle heartbeat error with response message', async () => {
      conductorService.setWorkerId('worker-123');
      axios.post.mockRejectedValue(mockAxiosError('Worker not found', 404));

      await expect(conductorService.sendHeartbeat()).rejects.toThrow('re-registration required');
      expect(conductorService.getWorkerId()).toBeNull();
    });

    test('should handle heartbeat error without response message', async () => {
      conductorService.setWorkerId('worker-123');
      const error = mockAxiosError('', 500);
      error.response.data = {};
      axios.post.mockRejectedValue(error);

      await expect(conductorService.sendHeartbeat()).rejects.toThrow('Heartbeat failed');
    });

    test('should handle connection error during heartbeat', async () => {
      conductorService.setWorkerId('worker-123');
      axios.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(conductorService.sendHeartbeat()).rejects.toThrow('Failed to connect to conductor');
    });
  });

  describe('updateResources error handling', () => {
    test('should handle resource update error with response message', async () => {
      conductorService.setWorkerId('worker-123');
      axios.put.mockRejectedValue(mockAxiosError('Resource update failed', 500));

      await expect(
        conductorService.updateResources({ cpu_cores: 4 })
      ).rejects.toThrow('Resource update failed');
    });

    test('should handle resource update 404 and clear worker ID', async () => {
      conductorService.setWorkerId('worker-123');
      axios.put.mockRejectedValue(mockAxiosError('Worker not found', 404));

      await expect(
        conductorService.updateResources({ cpu_cores: 4 })
      ).rejects.toThrow('re-registration required');
      expect(conductorService.getWorkerId()).toBeNull();
    });

    test('should handle connection error during resource update', async () => {
      conductorService.setWorkerId('worker-123');
      axios.put.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        conductorService.updateResources({ cpu_cores: 4 })
      ).rejects.toThrow('Failed to connect to conductor');
    });
  });
});

