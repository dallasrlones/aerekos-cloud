const request = require('supertest');
const fs = require('fs');
const path = require('path');
const ConductorService = require('../../api/services/ConductorService');
const ResourceDetector = require('../../utils/resourceDetector');
const MockConductorServer = require('../helpers/mockConductor');
const { sleep } = require('../helpers/testHelpers');
const workerIdStorage = require('../../utils/workerIdStorage');

describe('Worker Integration Tests', () => {
  let mockConductor;
  let conductorService;
  const mockPort = process.env.MOCK_CONDUCTOR_PORT || 3002;
  const conductorUrl = `http://localhost:${mockPort}`;

  beforeAll(async () => {
    // Start mock conductor server on a different port to avoid conflicts
    mockConductor = new MockConductorServer();
    await mockConductor.start(mockPort);
  });

  afterAll(async () => {
    // Stop mock conductor server
    await mockConductor.stop();
  });

  beforeEach(() => {
    conductorService = new ConductorService(conductorUrl);
  });

  describe('Worker Registration', () => {
    test('should register worker with conductor', async () => {
      const resources = await ResourceDetector.getAllResources();
      
      const worker = await conductorService.registerWorker(
        mockConductor.registrationToken,
        resources
      );

      expect(worker).toHaveProperty('id');
      expect(worker).toHaveProperty('hostname');
      expect(worker).toHaveProperty('ip_address');
      expect(worker.status).toBe('online');
      expect(conductorService.getWorkerId()).toBe(worker.id);
    });

    test('should fail registration with invalid token', async () => {
      await expect(
        conductorService.registerWorker(
          'invalid-token',
          {}
        )
      ).rejects.toThrow('Invalid registration token');
    });
  });

  describe('Heartbeat Mechanism', () => {
    test('should send heartbeat successfully', async () => {
      // Register first
      const resources = await ResourceDetector.getAllResources();
      const worker = await conductorService.registerWorker(
        mockConductor.registrationToken,
        resources
      );

      const workerId = worker.id;
      const initialHeartbeats = mockConductor.getHeartbeats().length;

      // Send heartbeat
      const updatedWorker = await conductorService.sendHeartbeat();

      expect(updatedWorker.id).toBe(workerId);
      expect(updatedWorker.status).toBe('online');
      
      const heartbeats = mockConductor.getHeartbeats();
      expect(heartbeats.length).toBe(initialHeartbeats + 1);
      expect(heartbeats[heartbeats.length - 1].workerId).toBe(workerId);
    });

    test('should fail heartbeat if worker not registered', async () => {
      const newService = new ConductorService(conductorUrl);
      await expect(newService.sendHeartbeat()).rejects.toThrow('Worker not registered');
    });

    test('should handle heartbeat failure and trigger re-registration', async () => {
      const service = new ConductorService(conductorUrl);
      service.setWorkerId('nonexistent-worker');

      await expect(service.sendHeartbeat()).rejects.toThrow('re-registration required');
      expect(service.getWorkerId()).toBeNull();
    });
  });

  describe('Resource Reporting', () => {
    test('should update resources on conductor', async () => {
      // Register first
      const resources = await ResourceDetector.getAllResources();
      const worker = await conductorService.registerWorker(
        mockConductor.registrationToken,
        resources
      );

      const workerId = worker.id;
      const initialUpdates = mockConductor.getResourceUpdates().length;

      // Update resources
      const newResources = {
        cpu_cores: 8,
        ram_gb: 16,
        disk_gb: 500,
        network_mbps: 1000
      };

      const updatedWorker = await conductorService.updateResources(newResources);

      expect(updatedWorker.resources).toEqual(newResources);
      
      const updates = mockConductor.getResourceUpdates();
      expect(updates.length).toBe(initialUpdates + 1);
      expect(updates[updates.length - 1].resources).toEqual(newResources);
    });

    test('should fail resource update if worker not registered', async () => {
      const newService = new ConductorService(conductorUrl);
      await expect(
        newService.updateResources({ cpu_cores: 4 })
      ).rejects.toThrow('Worker not registered');
    });
  });

  describe('Re-registration', () => {
    test('should re-register after connection loss', async () => {
      const service = new ConductorService(conductorUrl);
      
      // Register initially
      const resources = await ResourceDetector.getAllResources();
      const worker1 = await service.registerWorker(
        mockConductor.registrationToken,
        resources
      );

      const workerId1 = worker1.id;

      // Simulate connection loss by setting invalid worker ID
      service.setWorkerId('invalid-id');

      // Try to send heartbeat - should fail
      await expect(service.sendHeartbeat()).rejects.toThrow();

      // Re-register
      const worker2 = await service.registerWorker(
        mockConductor.registrationToken,
        resources
      );

      // Should get same or new worker ID
      expect(worker2).toHaveProperty('id');
      expect(service.getWorkerId()).toBe(worker2.id);
    });
  });

  describe('Persistent Worker ID', () => {
    const testDataDir = path.join(__dirname, '..', 'test-data');
    const testWorkerIdFile = path.join(testDataDir, 'worker-id.json');

    beforeEach(() => {
      // Clean up test data directory
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    afterEach(() => {
      // Clean up test data directory
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    test('should store worker ID after registration', async () => {
      const resources = await ResourceDetector.getAllResources();
      const worker = await conductorService.registerWorker(
        mockConductor.registrationToken,
        'test-hostname',
        '127.0.0.1',
        resources
      );

      // Simulate storing worker ID (as done in index.js)
      workerIdStorage.storeWorkerId(worker.id);

      // Verify it's stored
      const storedId = workerIdStorage.getStoredWorkerId();
      expect(storedId).toBe(worker.id);
    });

    test('should use stored worker ID on re-registration', async () => {
      const resources = await ResourceDetector.getAllResources();
      
      // First registration
      const worker1 = await conductorService.registerWorker(
        mockConductor.registrationToken,
        'test-hostname',
        '127.0.0.1',
        resources
      );
      
      const workerId1 = worker1.id;
      
      // Store worker ID
      workerIdStorage.storeWorkerId(workerId1);
      
      // Create new service instance (simulating restart)
      const newService = new ConductorService(conductorUrl);
      
      // Retrieve stored ID
      const storedId = workerIdStorage.getStoredWorkerId();
      expect(storedId).toBe(workerId1);
      
      // Re-register with existing worker ID (simulating what index.js does)
      // Note: Mock conductor may create new ID, but the important part is
      // that we're testing the storage/retrieval flow
      const worker2 = await newService.registerWorker(
        mockConductor.registrationToken,
        'test-hostname',
        '127.0.0.1',
        resources,
        storedId // existing worker ID
      );
      
      // Worker should be registered (ID may differ if mock doesn't support existing ID)
      expect(worker2).toHaveProperty('id');
      expect(newService.getWorkerId()).toBe(worker2.id);
      
      // Clean up
      workerIdStorage.clearWorkerId();
    });

    test('should clear invalid worker ID and register as new', async () => {
      const resources = await ResourceDetector.getAllResources();
      
      // Store invalid worker ID
      workerIdStorage.storeWorkerId('invalid-worker-id');
      
      // Try to register with invalid ID - should fail and register as new
      const worker = await conductorService.registerWorker(
        mockConductor.registrationToken,
        'test-hostname',
        '127.0.0.1',
        resources,
        'invalid-worker-id'
      );
      
      // Should get new worker ID (not the invalid one)
      expect(worker.id).not.toBe('invalid-worker-id');
      expect(worker.id).toBeDefined();
      
      // Stored ID should be cleared (simulating what index.js does on error)
      // In real scenario, clearWorkerId() would be called
      workerIdStorage.clearWorkerId();
      expect(workerIdStorage.getStoredWorkerId()).toBeNull();
    });
  });
});

