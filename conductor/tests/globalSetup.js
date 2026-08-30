/**
 * Global test setup - runs once before all tests
 */
module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = './data/test-conductor.db';
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.PORT = '3001';
  
  // Clean up any existing test database
  const fs = require('fs');
  const path = require('path');
  const testDbPath = path.join(__dirname, '../data/test-conductor.db');
  const testDbShm = path.join(__dirname, '../data/test-conductor.db-shm');
  const testDbWal = path.join(__dirname, '../data/test-conductor.db-wal');
  
  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDbShm)) {
      fs.unlinkSync(testDbShm);
    }
    if (fs.existsSync(testDbWal)) {
      fs.unlinkSync(testDbWal);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
  
  console.log('✅ Global test setup complete');
};
