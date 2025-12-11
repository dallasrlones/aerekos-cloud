// Jest setup file
// This runs before all tests

// Set test environment
process.env.NODE_ENV = 'test';
process.env.CONDUCTOR_URL = 'http://localhost:3000';
process.env.CONDUCTOR_TOKEN = 'test-token';
process.env.WORKER_HOSTNAME = 'test-worker';
process.env.WORKER_IP = '127.0.0.1';
process.env.HEARTBEAT_INTERVAL = '30';
process.env.RESOURCE_CHECK_INTERVAL = '60';
process.env.PORT = '3002'; // Use different port for tests

// Suppress console logs during tests (optional - uncomment if needed)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

