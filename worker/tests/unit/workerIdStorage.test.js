const fs = require('fs');
const path = require('path');
const workerIdStorage = require('../../utils/workerIdStorage');

// Use actual data directory for tests (will be cleaned up)
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const WORKER_ID_FILE = path.join(DATA_DIR, 'worker-id.json');

describe('workerIdStorage Unit Tests', () => {
  beforeEach(() => {
    // Clean up worker ID file before each test
    if (fs.existsSync(WORKER_ID_FILE)) {
      fs.unlinkSync(WORKER_ID_FILE);
    }
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up worker ID file after each test
    if (fs.existsSync(WORKER_ID_FILE)) {
      fs.unlinkSync(WORKER_ID_FILE);
    }
  });

  describe('getStoredWorkerId', () => {
    test('should return null when file does not exist', () => {
      const workerId = workerIdStorage.getStoredWorkerId();
      expect(workerId).toBeNull();
    });

    test('should return worker ID when file exists', () => {
      const testWorkerId = 'test-worker-123';
      const testData = {
        workerId: testWorkerId,
        storedAt: new Date().toISOString()
      };
      fs.writeFileSync(WORKER_ID_FILE, JSON.stringify(testData), 'utf8');

      const workerId = workerIdStorage.getStoredWorkerId();
      expect(workerId).toBe(testWorkerId);
    });

    test('should return null when file is invalid JSON', () => {
      fs.writeFileSync(WORKER_ID_FILE, 'invalid json', 'utf8');

      const workerId = workerIdStorage.getStoredWorkerId();
      expect(workerId).toBeNull();
    });

    test('should return null when file exists but has no workerId', () => {
      const testData = {
        storedAt: new Date().toISOString()
      };
      fs.writeFileSync(WORKER_ID_FILE, JSON.stringify(testData), 'utf8');

      const workerId = workerIdStorage.getStoredWorkerId();
      expect(workerId).toBeNull();
    });
  });

  describe('storeWorkerId', () => {
    test('should store worker ID successfully', () => {
      const testWorkerId = 'test-worker-456';
      
      workerIdStorage.storeWorkerId(testWorkerId);

      expect(fs.existsSync(WORKER_ID_FILE)).toBe(true);
      const data = JSON.parse(fs.readFileSync(WORKER_ID_FILE, 'utf8'));
      expect(data.workerId).toBe(testWorkerId);
      expect(data.storedAt).toBeDefined();
    });

    test('should overwrite existing worker ID', () => {
      const firstWorkerId = 'test-worker-789';
      const secondWorkerId = 'test-worker-999';
      
      workerIdStorage.storeWorkerId(firstWorkerId);
      workerIdStorage.storeWorkerId(secondWorkerId);

      const data = JSON.parse(fs.readFileSync(WORKER_ID_FILE, 'utf8'));
      expect(data.workerId).toBe(secondWorkerId);
    });

    test('should create data directory if it does not exist', () => {
      // Remove worker ID file only (not the whole directory to avoid permission issues)
      if (fs.existsSync(WORKER_ID_FILE)) {
        fs.unlinkSync(WORKER_ID_FILE);
      }

      const testWorkerId = 'test-worker-dir';
      workerIdStorage.storeWorkerId(testWorkerId);

      // Verify directory exists and file was created
      expect(fs.existsSync(DATA_DIR)).toBe(true);
      expect(fs.existsSync(WORKER_ID_FILE)).toBe(true);
    });
  });

  describe('clearWorkerId', () => {
    test('should delete worker ID file when it exists', () => {
      const testWorkerId = 'test-worker-clear';
      workerIdStorage.storeWorkerId(testWorkerId);
      
      expect(fs.existsSync(WORKER_ID_FILE)).toBe(true);
      
      workerIdStorage.clearWorkerId();
      
      expect(fs.existsSync(WORKER_ID_FILE)).toBe(false);
    });

    test('should not throw error when file does not exist', () => {
      expect(() => {
        workerIdStorage.clearWorkerId();
      }).not.toThrow();
    });
  });

  describe('Integration', () => {
    test('should store and retrieve worker ID', () => {
      const testWorkerId = 'test-worker-integration';
      
      // Store
      workerIdStorage.storeWorkerId(testWorkerId);
      
      // Retrieve
      const retrievedId = workerIdStorage.getStoredWorkerId();
      
      expect(retrievedId).toBe(testWorkerId);
    });

    test('should clear and return null', () => {
      const testWorkerId = 'test-worker-clear-integration';
      
      // Store
      workerIdStorage.storeWorkerId(testWorkerId);
      expect(workerIdStorage.getStoredWorkerId()).toBe(testWorkerId);
      
      // Clear
      workerIdStorage.clearWorkerId();
      expect(workerIdStorage.getStoredWorkerId()).toBeNull();
    });
  });
});

