const validateServiceToken = require('../../api/middleware/auth');
const axios = require('axios');

jest.mock('axios');

describe('Authentication Middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      headers: {},
      service: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    process.env.CONDUCTOR_URL = 'http://localhost:3000';
  });
  
  test('should reject request without token', async () => {
    req.headers.authorization = undefined;
    
    await validateServiceToken(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Service token required', status: 401 }
    });
    expect(next).not.toHaveBeenCalled();
  });
  
  test('should accept valid token', async () => {
    req.headers.authorization = 'Bearer valid-token';
    
    axios.post.mockResolvedValue({
      data: {
        service: {
          name: 'test-service',
          id: 'service-id'
        }
      }
    });
    
    await validateServiceToken(req, res, next);
    
    expect(req.service).toHaveProperty('name', 'test-service');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
  
  test('should handle invalid token', async () => {
    req.headers.authorization = 'Bearer invalid-token';
    
    axios.post.mockRejectedValue({
      response: {
        status: 401
      }
    });
    
    await validateServiceToken(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Invalid service token', status: 401 }
    });
    expect(next).not.toHaveBeenCalled();
  });
  
  test('should fail-closed (503) when validation endpoint not found in conductor', async () => {
    req.headers.authorization = 'Bearer test-token';

    axios.post.mockRejectedValue({
      response: {
        status: 404
      }
    });

    await validateServiceToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Service authentication unavailable', status: 503 }
    });
    expect(next).not.toHaveBeenCalled();
  });
  
  test('should extract token from Bearer header', async () => {
    req.headers.authorization = 'Bearer token123';
    
    axios.post.mockResolvedValue({
      data: {
        service: { name: 'test' }
      }
    });
    
    await validateServiceToken(req, res, next);
    
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      { token: 'token123' },
      expect.any(Object)
    );
  });
});
