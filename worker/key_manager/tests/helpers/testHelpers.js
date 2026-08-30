/**
 * Test helpers for key_manager service
 */

/**
 * Generate a test master key (64 hex characters)
 */
function generateTestMasterKey() {
  return 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
}

/**
 * Mock conductor service registration
 */
function mockConductorRegistration() {
  return {
    service_id: 'test-service-id',
    service_token: 'test-service-token-12345',
    registered_at: new Date().toISOString()
  };
}

module.exports = {
  generateTestMasterKey,
  mockConductorRegistration
};
