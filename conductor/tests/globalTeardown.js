/**
 * Global test teardown - runs once after all tests
 */
module.exports = async () => {
  const fs = require('fs');
  const path = require('path');
  
  // Clean up test database files
  const testDbPath = path.join(__dirname, '../data/test-conductor.db');
  const testDbShm = path.join(__dirname, '../data/test-conductor.db-shm');
  const testDbWal = path.join(__dirname, '../data/test-conductor.db-wal');
  
  try {
    // Wait a bit for any pending database operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDbShm)) {
      fs.unlinkSync(testDbShm);
    }
    if (fs.existsSync(testDbWal)) {
      fs.unlinkSync(testDbWal);
    }
    
    console.log('✅ Global test teardown complete - test database cleaned up');
  } catch (error) {
    console.warn('⚠️  Warning: Could not clean up test database:', error.message);
  }
};
