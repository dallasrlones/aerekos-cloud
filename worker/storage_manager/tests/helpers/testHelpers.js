const fs = require('fs').promises;
const path = require('path');

/**
 * Create a temporary test database path
 */
function getTestDbPath() {
  const worker = process.env.JEST_WORKER_ID || '0';
  return path.join(__dirname, '../../data', `test_storage_manager_${worker}.db`);
}

/**
 * Create a temporary storage directory
 */
function getTestStoragePath() {
  return path.join(__dirname, '../../storage/test');
}

/**
 * Clean up test database
 */
async function cleanupTestDb() {
  const dbPath = getTestDbPath();
  try {
    await fs.unlink(dbPath);
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

/**
 * Clean up test storage directory
 */
async function cleanupTestStorage() {
  const storagePath = getTestStoragePath();
  try {
    await fs.rm(storagePath, { recursive: true, force: true });
  } catch (error) {
    // Ignore if directory doesn't exist
  }
}

/**
 * Create test file buffer
 */
function createTestFileBuffer(size = 1024) {
  return Buffer.alloc(size, 'test-data');
}

/**
 * Create test project data
 */
function createTestProject(overrides = {}) {
  return {
    name: `test-project-${Date.now()}`,
    created_by: 'test-service',
    metadata: JSON.stringify({ test: true }),
    ...overrides
  };
}

/**
 * Create test bucket data
 */
function createTestBucket(projectId, overrides = {}) {
  return {
    project_id: projectId,
    name: `test-bucket-${Date.now()}`,
    created_by: 'test-service',
    encryption_key_name: 'test-encryption-key',
    metadata: JSON.stringify({ test: true }),
    ...overrides
  };
}

/**
 * Create test file data
 */
function createTestFile(bucketId, overrides = {}) {
  return {
    bucket_id: bucketId,
    key: `test-file-${Date.now()}.txt`,
    size: 1024,
    content_type: 'text/plain',
    etag: 'test-etag',
    encryption_key_version: 1,
    storage_path: '/test/path',
    chunk_count: 1,
    chunk_size: 1024,
    upload_id: null,
    upload_status: 'completed',
    metadata: JSON.stringify({ test: true }),
    ...overrides
  };
}

/**
 * Mock conductor service registration
 */
function mockConductorRegistration() {
  return {
    service_id: 'test-service-id',
    service_token: 'test-service-token',
    port: 3003
  };
}

/**
 * Mock key_manager response
 */
function mockKeyManagerResponse() {
  return {
    key_material: 'dev-mock-key-material-change-when-key-manager-ready-32bytes!!',
    key_version: 1,
    algorithm: 'AES-256-GCM'
  };
}

module.exports = {
  getTestDbPath,
  getTestStoragePath,
  cleanupTestDb,
  cleanupTestStorage,
  createTestFileBuffer,
  createTestProject,
  createTestBucket,
  createTestFile,
  mockConductorRegistration,
  mockKeyManagerResponse
};
