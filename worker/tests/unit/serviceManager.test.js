const Docker = require('dockerode');

// Mock dockerode before requiring ServiceManager
jest.mock('dockerode');

// Create mock container
const mockContainer = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  restart: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  inspect: jest.fn().mockResolvedValue({
    Id: 'container-123',
    State: {
      Running: true,
      Status: 'running',
      StartedAt: new Date().toISOString()
    },
    RestartCount: 0
  })
};

// Create mock Docker instance
const mockDocker = {
  ping: jest.fn().mockResolvedValue('OK'),
  listContainers: jest.fn().mockResolvedValue([]),
  createContainer: jest.fn().mockResolvedValue(mockContainer),
  getContainer: jest.fn().mockReturnValue(mockContainer)
};

// Mock Docker constructor
Docker.mockImplementation(() => mockDocker);

// Now require ServiceManager after mocks are set up
const ServiceManager = require('../../docker/ServiceManager');

describe('ServiceManager Unit Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockDocker.ping.mockResolvedValue('OK');
    mockDocker.listContainers.mockResolvedValue([]);
    mockDocker.createContainer.mockResolvedValue(mockContainer);
    mockDocker.getContainer.mockReturnValue(mockContainer);
    
    mockContainer.start.mockResolvedValue(undefined);
    mockContainer.stop.mockResolvedValue(undefined);
    mockContainer.restart.mockResolvedValue(undefined);
    mockContainer.inspect.mockResolvedValue({
      Id: 'container-123',
      State: {
        Running: true,
        Status: 'running',
        StartedAt: new Date().toISOString()
      },
      RestartCount: 0
    });
  });

  describe('getContainerName', () => {
    test('should generate correct container name', () => {
      const name = ServiceManager.getContainerName('test-service');
      expect(name).toBe('aerekos-test-service');
    });
  });

  describe('checkDockerConnection', () => {
    test('should return true when Docker is accessible', async () => {
      // Ensure ping is resolved
      mockDocker.ping.mockResolvedValue('OK');
      const connected = await ServiceManager.checkDockerConnection();
      expect(connected).toBe(true);
      expect(mockDocker.ping).toHaveBeenCalled();
    });

    test('should return false when Docker is not accessible', async () => {
      mockDocker.ping.mockRejectedValueOnce(new Error('Connection refused'));
      const connected = await ServiceManager.checkDockerConnection();
      expect(connected).toBe(false);
      expect(mockDocker.ping).toHaveBeenCalled();
    });
  });

  describe('findContainerByName', () => {
    test('should find existing container', async () => {
      const containerData = {
        Id: 'container-123',
        Names: ['/aerekos-test-service'],
        State: 'running'
      };
      
      mockDocker.listContainers.mockResolvedValue([containerData]);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const container = await ServiceManager.findContainerByName('aerekos-test-service');
      expect(container).toBeDefined();
      expect(container).toBe(mockContainer);
      expect(mockDocker.getContainer).toHaveBeenCalledWith('container-123');
    });

    test('should return null when container not found', async () => {
      mockDocker.listContainers.mockResolvedValue([]);
      const container = await ServiceManager.findContainerByName('nonexistent');
      expect(container).toBeNull();
    });
  });

  describe('startService', () => {
    test('should start existing stopped container', async () => {
      const containerData = {
        Id: 'container-123',
        Names: ['/aerekos-test-service'],
        State: 'exited'
      };
      
      mockDocker.listContainers.mockResolvedValue([containerData]);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      mockContainer.inspect.mockResolvedValue({
        Id: 'container-123',
        State: {
          Running: false,
          Status: 'exited'
        }
      });

      const result = await ServiceManager.startService('test-service', {
        docker_image: 'test-image:latest'
      });

      expect(result).toHaveProperty('id', 'container-123');
      expect(result).toHaveProperty('status', 'started');
      expect(mockContainer.start).toHaveBeenCalled();
    });

    test('should create and start new container', async () => {
      mockDocker.listContainers.mockResolvedValue([]);
      mockDocker.createContainer.mockResolvedValue(mockContainer);
      
      // Mock container.id property
      Object.defineProperty(mockContainer, 'id', {
        value: 'container-123',
        writable: true
      });

      const config = {
        docker_image: 'test-image:latest',
        environment: ['ENV_VAR=value'],
        ports: { '8080': '8080' }
      };

      const result = await ServiceManager.startService('test-service', config);

      expect(result).toHaveProperty('id', 'container-123');
      expect(result).toHaveProperty('status', 'created_and_started');
      expect(mockDocker.createContainer).toHaveBeenCalled();
      expect(mockContainer.start).toHaveBeenCalled();
    });

    test('should throw error if service already running', async () => {
      const containerData = {
        Id: 'container-123',
        Names: ['/aerekos-test-service'],
        State: 'running'
      };
      
      mockDocker.listContainers.mockResolvedValue([containerData]);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      mockContainer.inspect.mockResolvedValue({
        Id: 'container-123',
        State: {
          Running: true,
          Status: 'running'
        }
      });

      await expect(
        ServiceManager.startService('test-service', { docker_image: 'test-image:latest' })
      ).rejects.toThrow('already running');
    });
  });

  describe('stopService', () => {
    test('should stop running service', async () => {
      const containerData = {
        Id: 'container-123',
        Names: ['/aerekos-test-service'],
        State: 'running'
      };
      
      mockDocker.listContainers.mockResolvedValue([containerData]);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      mockContainer.inspect.mockResolvedValue({
        Id: 'container-123',
        State: {
          Running: true,
          Status: 'running'
        }
      });

      const result = await ServiceManager.stopService('test-service');

      expect(result).toHaveProperty('status', 'stopped');
      expect(mockContainer.stop).toHaveBeenCalled();
    });

    test('should throw error if service not found', async () => {
      mockDocker.listContainers.mockResolvedValue([]);

      await expect(
        ServiceManager.stopService('nonexistent')
      ).rejects.toThrow('not found');
    });

    test('should throw error if service already stopped', async () => {
      const containerData = {
        Id: 'container-123',
        Names: ['/aerekos-test-service'],
        State: 'exited'
      };
      
      mockDocker.listContainers.mockResolvedValue([containerData]);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      mockContainer.inspect.mockResolvedValue({
        Id: 'container-123',
        State: {
          Running: false,
          Status: 'exited'
        }
      });

      await expect(
        ServiceManager.stopService('test-service')
      ).rejects.toThrow('not running');
    });
  });

  describe('restartService', () => {
    test('should restart service', async () => {
      const containerData = {
        Id: 'container-123',
        Names: ['/aerekos-test-service'],
        State: 'running'
      };
      
      mockDocker.listContainers.mockResolvedValue([containerData]);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await ServiceManager.restartService('test-service');

      expect(result).toHaveProperty('status', 'restarted');
      expect(mockContainer.restart).toHaveBeenCalled();
    });
  });

  describe('getServiceStatus', () => {
    test('should return service status', async () => {
      const containerData = {
        Id: 'container-123',
        Names: ['/aerekos-test-service'],
        State: 'running'
      };
      
      mockDocker.listContainers.mockResolvedValue([containerData]);
      mockDocker.getContainer.mockReturnValue(mockContainer);

      mockContainer.inspect.mockResolvedValue({
        Id: 'container-123',
        State: {
          Running: true,
          Status: 'running',
          StartedAt: new Date().toISOString()
        },
        RestartCount: 0
      });

      const status = await ServiceManager.getServiceStatus('test-service');

      expect(status).toHaveProperty('service', 'test-service');
      expect(status).toHaveProperty('status', 'running');
      expect(status).toHaveProperty('running', true);
    });

    test('should return not_found for non-existent service', async () => {
      mockDocker.listContainers.mockResolvedValue([]);

      const status = await ServiceManager.getServiceStatus('nonexistent');

      expect(status).toHaveProperty('status', 'not_found');
      expect(status).toHaveProperty('running', false);
    });
  });

  describe('listServices', () => {
    test('should list all managed services', async () => {
      const containerInfo = {
        Id: 'container-123',
        Names: ['/aerekos-test-service'],
        State: 'running',
        Image: 'test-image:latest',
        Created: Date.now() / 1000
      };
      
      mockDocker.listContainers.mockResolvedValue([containerInfo]);
      
      // Mock inspect for the container
      const containerInstance = {
        inspect: jest.fn().mockResolvedValue({
          Id: 'container-123',
          State: {
            Running: true,
            StartedAt: new Date().toISOString()
          }
        })
      };
      mockDocker.getContainer.mockReturnValue(containerInstance);

      const services = await ServiceManager.listServices();

      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
      expect(services[0]).toHaveProperty('service');
      expect(services[0]).toHaveProperty('running');
    });
  });

  describe('handleDockerError', () => {
    test('should categorize 404 errors', () => {
      const error = { statusCode: 404, message: 'Not found' };
      // Access the method through the instance
      const errorInfo = ServiceManager.handleDockerError(error, 'start', 'test-service');
      
      expect(errorInfo.type).toBe('NOT_FOUND');
      expect(errorInfo.message).toContain('not found');
    });

    test('should categorize 409 errors', () => {
      const error = { statusCode: 409, message: 'Conflict' };
      const errorInfo = ServiceManager.handleDockerError(error, 'start', 'test-service');
      
      expect(errorInfo.type).toBe('CONFLICT');
      expect(errorInfo.message).toContain('already');
    });

    test('should categorize connection errors', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const errorInfo = ServiceManager.handleDockerError(error, 'start', 'test-service');
      
      expect(errorInfo.type).toBe('CONNECTION_ERROR');
      expect(errorInfo.message).toContain('Docker daemon');
    });
  });
});

