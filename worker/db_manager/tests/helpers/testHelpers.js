const axios = require('axios');

// Mock conductor URL and service token for tests
const mockConductorUrl = 'http://localhost:3000';
const mockServiceToken = 'test-service-token';

// Helper to create mock axios responses
function createMockAxiosResponse(data, status = 200) {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {}
  };
}

// Helper to create mock axios error
function createMockAxiosError(status, message) {
  const error = new Error(message);
  error.response = {
    status,
    data: { error: { message } }
  };
  return error;
}

module.exports = {
  mockConductorUrl,
  mockServiceToken,
  createMockAxiosResponse,
  createMockAxiosError
};
