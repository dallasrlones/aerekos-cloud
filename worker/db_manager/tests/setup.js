// Test setup file
// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests
process.env.MOCK_KEY_MANAGER = 'true';
process.env.CONDUCTOR_URL = 'http://localhost:3000';
process.env.SERVICE_TOKEN = 'test-service-token';
