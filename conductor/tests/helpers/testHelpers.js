/**
 * General test helper utilities
 */

/**
 * Generate unique identifier for test data
 */
function uniqueId(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique email for test data
 */
function uniqueEmail(prefix = 'test') {
  return `${prefix}-${Date.now()}@example.com`;
}

/**
 * Wait for a specified amount of time
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or max attempts reached
 */
async function retry(fn, maxAttempts = 3, delay = 100) {
  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxAttempts - 1) {
        await wait(delay * (i + 1)); // Exponential backoff
      }
    }
  }
  throw lastError;
}

/**
 * Create a test JWT token
 */
function createTestToken(payload = {}) {
  const JWTService = require('../../api/services/JWTService');
  return JWTService.generateToken({
    id: payload.id || 'test-id',
    username: payload.username || 'testuser',
    email: payload.email || 'test@example.com',
    role: payload.role || 'user',
    ...payload
  });
}

module.exports = {
  uniqueId,
  uniqueEmail,
  wait,
  retry,
  createTestToken
};
