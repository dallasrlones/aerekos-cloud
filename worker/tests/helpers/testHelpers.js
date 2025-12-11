/**
 * Test helper utilities
 */

/**
 * Generate a unique ID for testing
 * @returns {string} Unique ID
 */
function uniqueId() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock axios response
 * @param {object} data - Response data
 * @param {number} status - HTTP status code
 * @returns {object} Mock response
 */
function mockAxiosResponse(data, status = 200) {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {}
  };
}

/**
 * Mock axios error
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Error} Mock error
 */
function mockAxiosError(message, status = 500) {
  const error = new Error(message);
  error.response = {
    data: { error: { message, status } },
    status,
    statusText: 'Error',
    headers: {},
    config: {}
  };
  return error;
}

module.exports = {
  uniqueId,
  sleep,
  mockAxiosResponse,
  mockAxiosError
};

