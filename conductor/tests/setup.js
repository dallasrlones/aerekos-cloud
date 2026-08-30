// Jest setup file
// This runs before all tests

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = './data/test-conductor.db';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PORT = '3001'; // Use different port for tests

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
