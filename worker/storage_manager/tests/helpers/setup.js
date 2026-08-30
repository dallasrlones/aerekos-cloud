const { getTestDbPath, getTestStoragePath, cleanupTestDb, cleanupTestStorage } = require('./testHelpers');

/**
 * Setup test environment
 */
async function setupTestEnvironment() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = getTestDbPath();
  process.env.STORAGE_PATH = getTestStoragePath();
  process.env.MOCK_KEY_MANAGER = 'true';
  process.env.CONDUCTOR_URL = 'http://localhost:3000';
  process.env.SERVICE_TOKEN = 'test-token';
  
  // Clean up before starting
  await cleanupTestDb();
  await cleanupTestStorage();
}

/**
 * Teardown test environment
 */
async function teardownTestEnvironment() {
  await cleanupTestDb();
  await cleanupTestStorage();
}

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment
};
