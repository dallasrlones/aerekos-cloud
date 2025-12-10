/**
 * Database helper utilities for tests
 */
const { User, Worker, Service, Token, Resource, ServiceDeployment } = require('../../api/models');
const { initializeDatabase } = require('../../api/utils/dbInit');

/**
 * Initialize test database
 */
async function setupTestDatabase() {
  await initializeDatabase();
}

/**
 * Clean up all test data from database
 */
async function cleanupTestData() {
  try {
    // Get all records
    const users = await User.findAll();
    const workers = await Worker.findAll();
    const services = await Service.findAll();
    const tokens = await Token.findAll();
    const resources = await Resource.findAll();
    const deployments = await ServiceDeployment.findAll();

    // Delete in reverse dependency order
    for (const deployment of deployments) {
      try {
        await ServiceDeployment.delete(deployment.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const resource of resources) {
      try {
        await Resource.delete(resource.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const token of tokens) {
      try {
        await Token.delete(token.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const service of services) {
      try {
        await Service.delete(service.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const worker of workers) {
      try {
        await Worker.delete(worker.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const user of users) {
      try {
        await User.delete(user.id);
      } catch (e) {
        // Ignore errors
      }
    }
  } catch (error) {
    console.warn('Warning: Error during test data cleanup:', error.message);
  }
}

/**
 * Create a test user
 */
async function createTestUser(overrides = {}) {
  const { hashPassword } = require('../../api/utils/password');
  const timestamp = Date.now();
  
  // If password_hash is provided, use it; otherwise generate one
  const password_hash = overrides.password_hash || await hashPassword('testpass123');
  
  return await User.create({
    username: overrides.username || `testuser-${timestamp}`,
    email: overrides.email || `testuser-${timestamp}@example.com`,
    password_hash: password_hash,
    role: overrides.role || 'user',
    ...overrides
  });
}

/**
 * Create a test worker
 */
async function createTestWorker(overrides = {}) {
  const timestamp = Date.now();
  
  return await Worker.create({
    hostname: overrides.hostname || `worker-${timestamp}`,
    ip_address: overrides.ip_address || '192.168.1.100',
    status: overrides.status || 'online',
    last_seen: overrides.last_seen || new Date().toISOString(),
    resources: overrides.resources || JSON.stringify({ cpu: 4, ram: 8, disk: 100 }),
    ...overrides
  });
}

/**
 * Create a test service
 */
async function createTestService(overrides = {}) {
  const timestamp = Date.now();
  
  return await Service.create({
    name: overrides.name || `test-service-${timestamp}`,
    enabled: overrides.enabled !== undefined ? overrides.enabled : 1,
    docker_image: overrides.docker_image || 'test/image:latest',
    config: overrides.config || JSON.stringify({ port: 8080 }),
    ...overrides
  });
}

/**
 * Create a test token
 */
async function createTestToken(overrides = {}) {
  const { randomUUID } = require('crypto');
  
  return await Token.create({
    token: overrides.token || randomUUID(),
    expires_at: overrides.expires_at || null,
    active: overrides.active !== undefined ? overrides.active : 1,
    ...overrides
  });
}

module.exports = {
  setupTestDatabase,
  cleanupTestData,
  createTestUser,
  createTestWorker,
  createTestService,
  createTestToken
};
