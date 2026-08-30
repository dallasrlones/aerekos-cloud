const request = require('supertest');
const express = require('express');
const cors = require('cors');
const keyRoutes = require('../../api/routes/keys');
const errorHandler = require('../../api/middleware/errorHandler');
const validateServiceToken = require('../../api/middleware/auth');

// Mock auth middleware for testing
jest.mock('../../api/middleware/auth', () => {
  return jest.fn((req, res, next) => {
    req.service = { name: 'test-service', token: 'test-token' };
    next();
  });
});

describe('Key Manager API Integration Tests', () => {
  let app;
  const masterKey = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
  
  beforeEach(() => {
    app = express();
    app.use(cors());
    app.use(express.json());
    
    // Initialize key service
    keyRoutes.initializeKeyService(masterKey);
    
    app.use('/api', validateServiceToken);
    app.use('/api/keys', keyRoutes);
    app.use(errorHandler);
  });
  
  describe('POST /api/keys', () => {
    test('should create a symmetric key', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'test-symmetric-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM',
          metadata: { description: 'Test key' }
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'test-symmetric-key');
      expect(response.body).toHaveProperty('type', 'symmetric');
      expect(response.body).toHaveProperty('algorithm', 'AES-256-GCM');
      expect(response.body).not.toHaveProperty('key_material'); // Should not expose key material in create
    });
    
    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'test-key'
          // Missing type and algorithm
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('message');
    });
    
    test('should return 409 for duplicate key name', async () => {
      // Create first key
      await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'duplicate-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      // Try to create duplicate
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'duplicate-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      expect(response.status).toBe(409);
    });
  });
  
  describe('GET /api/keys/:name', () => {
    test('should get key by name with decrypted key material', async () => {
      // Create a key first
      const createResponse = await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'get-test-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      const keyId = createResponse.body.id;
      
      // Get the key
      const response = await request(app)
        .get('/api/keys/get-test-key')
        .set('Authorization', 'Bearer test-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'get-test-key');
      expect(response.body).toHaveProperty('key_material'); // Should include decrypted material
      expect(typeof response.body.key_material).toBe('string');
    });
    
    test('should return 404 for non-existent key', async () => {
      const response = await request(app)
        .get('/api/keys/nonexistent-key')
        .set('Authorization', 'Bearer test-token');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty('message');
    });
  });
  
  describe('GET /api/keys', () => {
    test('should list all keys', async () => {
      // Create a few keys
      await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'list-key-1',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'list-key-2',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      const response = await request(app)
        .get('/api/keys')
        .set('Authorization', 'Bearer test-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('keys');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.keys)).toBe(true);
      expect(response.body.keys.length).toBeGreaterThanOrEqual(2);
    });
    
    test('should filter keys by type', async () => {
      // Create keys of different types
      await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'symmetric-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'asymmetric-key',
          type: 'asymmetric',
          algorithm: 'RSA-4096'
        });
      
      const response = await request(app)
        .get('/api/keys?type=symmetric')
        .set('Authorization', 'Bearer test-token');
      
      expect(response.status).toBe(200);
      expect(response.body.keys.every(k => k.type === 'symmetric')).toBe(true);
    });
  });
  
  describe('POST /api/keys/:name/rotate', () => {
    test('should rotate key and create new version', async () => {
      // Create initial key
      await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'rotate-test-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      // Rotate the key
      const response = await request(app)
        .post('/api/keys/rotate-test-key/rotate')
        .set('Authorization', 'Bearer test-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('key_version', 2);
      expect(response.body).toHaveProperty('rotated_at');
    });
    
    test('should return 404 for non-existent key rotation', async () => {
      const response = await request(app)
        .post('/api/keys/nonexistent/rotate')
        .set('Authorization', 'Bearer test-token');
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('DELETE /api/keys/:name', () => {
    test('should delete key', async () => {
      // Create a key
      await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'delete-test-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      // Delete the key
      const deleteResponse = await request(app)
        .delete('/api/keys/delete-test-key')
        .set('Authorization', 'Bearer test-token');
      
      expect(deleteResponse.status).toBe(204);
      
      // Verify it's deleted
      const getResponse = await request(app)
        .get('/api/keys/delete-test-key')
        .set('Authorization', 'Bearer test-token');
      
      expect(getResponse.status).toBe(404);
    });
  });
  
  describe('POST /api/keys/:name/archive', () => {
    test('should archive key', async () => {
      // Create a key
      await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'archive-test-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        });
      
      // Archive the key
      const response = await request(app)
        .post('/api/keys/archive-test-key/archive')
        .set('Authorization', 'Bearer test-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('is_active', false);
    });
  });
});
