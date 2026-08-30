const fs = require('fs');
const path = require('path');

const WORKER_ID_FILE = path.join(__dirname, '..', 'data', 'worker-id.json');
const DATA_DIR = path.dirname(WORKER_ID_FILE);

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Get stored worker ID
 * @returns {string|null} Worker ID or null if not stored
 */
function getStoredWorkerId() {
  try {
    ensureDataDir();
    if (fs.existsSync(WORKER_ID_FILE)) {
      const data = JSON.parse(fs.readFileSync(WORKER_ID_FILE, 'utf8'));
      return data.workerId || null;
    }
  } catch (error) {
    console.error('Error reading worker ID file:', error.message);
  }
  return null;
}

/**
 * Store worker ID to file
 * @param {string} workerId - Worker ID to store
 */
function storeWorkerId(workerId) {
  try {
    ensureDataDir();
    const data = {
      workerId,
      storedAt: new Date().toISOString()
    };
    fs.writeFileSync(WORKER_ID_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✓ Worker ID stored: ${workerId}`);
  } catch (error) {
    console.error('Error storing worker ID:', error.message);
  }
}

/**
 * Clear stored worker ID
 */
function clearWorkerId() {
  try {
    if (fs.existsSync(WORKER_ID_FILE)) {
      fs.unlinkSync(WORKER_ID_FILE);
      console.log('✓ Worker ID cleared');
    }
  } catch (error) {
    console.error('Error clearing worker ID:', error.message);
  }
}

module.exports = {
  getStoredWorkerId,
  storeWorkerId,
  clearWorkerId
};

