/**
 * Test setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'key_manager';
process.env.SERVICE_VERSION = '1.0.0';
process.env.PORT = '3002';
process.env.CONDUCTOR_URL = 'http://localhost:3000';
process.env.MASTER_KEY = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests

// Increase timeout for integration tests
jest.setTimeout(10000);

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
