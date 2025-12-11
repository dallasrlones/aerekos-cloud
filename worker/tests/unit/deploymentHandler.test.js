const DeploymentHandler = require('../../services/DeploymentHandler');
const ServiceManager = require('../../docker/ServiceManager');
const ConductorService = require('../../api/services/ConductorService');

// Mock dependencies
jest.mock('../../docker/ServiceManager');
jest.mock('../../api/services/ConductorService');

describe('DeploymentHandler Unit Tests', () => {
  let deploymentHandler;
  let mockConductorService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConductorService = {
      reportServiceStatus: jest.fn().mockResolvedValue(undefined),
      getWorkerId: jest.fn().mockReturnValue('worker-123')
    };

    deploymentHandler = new DeploymentHandler(mockConductorService);
  });

  describe('handleDeploymentInstruction', () => {
    test('should handle deploy action', async () => {
      const mockResult = {
        service: 'test-service',
        action: 'deploy',
        status: 'success',
        container: { id: 'container-123' }
      };

      ServiceManager.startService = jest.fn().mockResolvedValue({ id: 'container-123' });

      const instruction = {
        action: 'deploy',
        service: 'test-service',
        config: {
          docker_image: 'test-image:latest'
        }
      };

      const result = await deploymentHandler.handleDeploymentInstruction(instruction);

      expect(result).toHaveProperty('service', 'test-service');
      expect(result).toHaveProperty('action', 'deploy');
      expect(result).toHaveProperty('status', 'success');
      expect(ServiceManager.startService).toHaveBeenCalledWith('test-service', instruction.config);
      expect(mockConductorService.reportServiceStatus).toHaveBeenCalledWith('test-service', 'success');
    });

    test('should handle stop action', async () => {
      ServiceManager.stopService = jest.fn().mockResolvedValue({
        id: 'container-123',
        status: 'stopped'
      });

      const instruction = {
        action: 'stop',
        service: 'test-service'
      };

      const result = await deploymentHandler.handleDeploymentInstruction(instruction);

      expect(result).toHaveProperty('action', 'stop');
      expect(ServiceManager.stopService).toHaveBeenCalledWith('test-service');
    });

    test('should handle restart action', async () => {
      ServiceManager.restartService = jest.fn().mockResolvedValue({
        id: 'container-123',
        status: 'restarted'
      });

      const instruction = {
        action: 'restart',
        service: 'test-service'
      };

      const result = await deploymentHandler.handleDeploymentInstruction(instruction);

      expect(result).toHaveProperty('action', 'restart');
      expect(ServiceManager.restartService).toHaveBeenCalledWith('test-service');
    });

    test('should handle update action', async () => {
      ServiceManager.updateService = jest.fn().mockResolvedValue({
        id: 'container-123',
        status: 'updated'
      });

      const instruction = {
        action: 'update',
        service: 'test-service',
        config: {
          docker_image: 'new-image:latest'
        }
      };

      const result = await deploymentHandler.handleDeploymentInstruction(instruction);

      expect(result).toHaveProperty('action', 'update');
      expect(ServiceManager.updateService).toHaveBeenCalledWith('test-service', instruction.config);
    });

    test('should handle remove action', async () => {
      ServiceManager.stopService = jest.fn().mockResolvedValue({});
      ServiceManager.findContainerByName = jest.fn().mockResolvedValue({
        remove: jest.fn().mockResolvedValue(undefined)
      });

      const instruction = {
        action: 'remove',
        service: 'test-service'
      };

      const result = await deploymentHandler.handleDeploymentInstruction(instruction);

      expect(result).toHaveProperty('action', 'remove');
      expect(ServiceManager.stopService).toHaveBeenCalledWith('test-service');
    });

    test('should throw error for invalid instruction', async () => {
      const instruction = {
        service: 'test-service'
        // Missing action
      };

      await expect(
        deploymentHandler.handleDeploymentInstruction(instruction)
      ).rejects.toThrow('action and service are required');
    });

    test('should throw error for unknown action', async () => {
      const instruction = {
        action: 'unknown',
        service: 'test-service'
      };

      await expect(
        deploymentHandler.handleDeploymentInstruction(instruction)
      ).rejects.toThrow('Unknown deployment action');
    });

    test('should report errors to conductor', async () => {
      ServiceManager.startService = jest.fn().mockRejectedValue(new Error('Docker error'));

      const instruction = {
        action: 'deploy',
        service: 'test-service',
        config: { docker_image: 'test-image:latest' }
      };

      await expect(
        deploymentHandler.handleDeploymentInstruction(instruction)
      ).rejects.toThrow('Docker error');

      expect(mockConductorService.reportServiceStatus).toHaveBeenCalledWith(
        'test-service',
        'failed'
      );
    });
  });

  describe('deployService', () => {
    test('should validate config requires docker_image', async () => {
      ServiceManager.startService = jest.fn();

      await expect(
        deploymentHandler.deployService('test-service', {})
      ).rejects.toThrow('requires docker_image');
    });

    test('should deploy service with valid config', async () => {
      ServiceManager.startService = jest.fn().mockResolvedValue({
        id: 'container-123',
        name: 'aerekos-test-service'
      });

      const result = await deploymentHandler.deployService('test-service', {
        docker_image: 'test-image:latest'
      });

      expect(result).toHaveProperty('status', 'success');
      expect(ServiceManager.startService).toHaveBeenCalled();
    });
  });

  describe('queueDeployment', () => {
    test('should add instruction to queue', () => {
      const instruction = {
        action: 'deploy',
        service: 'test-service',
        config: { docker_image: 'test-image:latest' }
      };

      ServiceManager.startService = jest.fn().mockResolvedValue({});

      deploymentHandler.queueDeployment(instruction);

      // Queue should process asynchronously
      expect(deploymentHandler.deploymentQueue.length).toBe(0); // Processed immediately
    });
  });
});

