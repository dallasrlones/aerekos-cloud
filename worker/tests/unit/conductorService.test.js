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
        { cpu_cores: 4, ram_gb: 8 }
      );

      expect(result).toEqual(mockWorker);
      expect(conductorService.getWorkerId()).toBe('worker-123');
      expect(axios.post).toHaveBeenCalledWith(
        `${conductorUrl}/api/workers/register`,
        {
          token: 'test-token',
          resources: { cpu_cores: 4, ram_gb: 8 }
        }
      );
    });

    test('should handle registration errors', async () => {
      axios.post.mockRejectedValue(mockAxiosError('Invalid token', 401));

      await expect(
        conductorService.registerWorker('invalid-token', {})
      ).rejects.toThrow('Invalid token');
    });

    test('should handle connection errors', async () => {
      axios.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        conductorService.registerWorker('test-token', {})
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
});

