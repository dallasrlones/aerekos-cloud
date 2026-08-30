const axios = require('axios');
const { registerWithConductor } = require('../../api/utils/serviceRegistration');
const detectAvailablePort = require('../../api/utils/portDetection');

jest.mock('axios');
jest.mock('../../api/utils/portDetection');

describe('Service Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONDUCTOR_URL = 'http://localhost:3000';
    process.env.SERVICE_NAME = 'key_manager';
    process.env.SERVICE_VERSION = '1.0.0';
    process.env.PORT = '3002';
  });
  
  test('should register successfully with conductor', async () => {
    detectAvailablePort.mockResolvedValue(3002);
    
    axios.post.mockResolvedValue({
      data: {
        service_id: 'test-service-id',
        service_token: 'test-service-token-12345',
        registered_at: new Date().toISOString()
      }
    });
    
    const result = await registerWithConductor();
    
    expect(result).toHaveProperty('service_id');
    expect(result).toHaveProperty('service_token');
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:3000/api/services/register',
      expect.objectContaining({
        name: 'key_manager',
        version: '1.0.0',
        port: 3002,
        health_endpoint: '/health',
        ready_endpoint: '/ready',
        capabilities: expect.arrayContaining(['key_management', 'encryption', 'key_rotation'])
      }),
      expect.any(Object)
    );
    expect(process.env.SERVICE_TOKEN).toBe('test-service-token-12345');
  });
  
  test('should handle registration failure gracefully', async () => {
    detectAvailablePort.mockResolvedValue(3002);

    const err = new Error('Request failed with status code 500');
    err.response = {
      status: 500,
      data: { error: 'Internal server error' }
    };
    axios.post.mockRejectedValue(err);

    await expect(registerWithConductor()).rejects.toThrow();
  });
  
  test('should handle 404 (endpoint not found) gracefully', async () => {
    detectAvailablePort.mockResolvedValue(3002);
    
    axios.post.mockRejectedValue({
      response: {
        status: 404,
        data: { error: 'Not found' }
      }
    });
    
    const result = await registerWithConductor();
    
    // Should return null and log warning, not throw
    expect(result).toBeNull();
  });
  
  test('should use detected port', async () => {
    detectAvailablePort.mockResolvedValue(3003);
    
    axios.post.mockResolvedValue({
      data: {
        service_id: 'test-id',
        service_token: 'test-token'
      }
    });
    
    await registerWithConductor();
    
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ port: 3003 }),
      expect.any(Object)
    );
  });
});
