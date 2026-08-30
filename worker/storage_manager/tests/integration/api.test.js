const request = require('supertest');
const express = require('express');
const { setupTestEnvironment, teardownTestEnvironment } = require('../helpers/setup');
const { getDatabase } = require('../../api/utils/dbClient');
const { initializeModels } = require('../../api/models');

// Import routes
const projectRoutes = require('../../api/routes/projects');
const bucketRoutes = require('../../api/routes/buckets');
const fileRoutes = require('../../api/routes/files');
const chunkedUploadRoutes = require('../../api/routes/chunkedUploads');
const signedUrlRoutes = require('../../api/routes/signedUrls');

let app;
let testProjectId;
let testBucketId;

beforeAll(async () => {
  await setupTestEnvironment();
  
  // Initialize database and models
  await getDatabase();
  await initializeModels();
  
  // Create test app
  app = express();
  app.use(express.json());
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects', bucketRoutes);
  app.use('/api/projects', signedUrlRoutes);
  app.use('/api/projects', chunkedUploadRoutes);
  app.use('/api/projects', fileRoutes);
  
  // Set test token
  process.env.SERVICE_TOKEN = 'test-token';
});

afterAll(async () => {
  await teardownTestEnvironment();
});

describe('API Integration Tests', () => {
  const authHeader = { Authorization: 'Bearer test-token' };

  describe('Projects API', () => {
    it('POST /api/projects should create a project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'test-project' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('test-project');
      testProjectId = response.body.id;
    });

    it('GET /api/projects should list projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('projects');
      expect(Array.isArray(response.body.projects)).toBe(true);
    });

    it('GET /api/projects/:projectId should get project details', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testProjectId);
    });

    it('POST /api/projects should return 409 if project already exists', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set(authHeader)
        .send({ name: 'test-project' });

      expect(response.status).toBe(409);
    });
  });

  describe('Buckets API', () => {
    it('POST /api/projects/:projectId/buckets should create a bucket', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/buckets`)
        .set(authHeader)
        .send({ name: 'test-bucket' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('test-bucket');
      testBucketId = response.body.id;
    });

    it('GET /api/projects/:projectId/buckets should list buckets', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/buckets`)
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('buckets');
      expect(Array.isArray(response.body.buckets)).toBe(true);
    });

    it('GET /api/projects/:projectId/buckets/:bucketName should get bucket details', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/buckets/test-bucket`)
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('test-bucket');
    });
  });

  describe('Files API', () => {
    it('POST /api/projects/:projectId/buckets/:bucketName/files/:key should upload file', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/buckets/test-bucket/files/test-file.txt`)
        .set(authHeader)
        .attach('file', Buffer.from('test file content'), 'test-file.txt');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('key', 'test-file.txt');
      expect(response.body).toHaveProperty('size');
    });

    it('GET /api/projects/:projectId/buckets/:bucketName/files/:key should download file', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/buckets/test-bucket/files/test-file.txt`)
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBeDefined();
    });

    it('HEAD /api/projects/:projectId/buckets/:bucketName/files/:key should get file metadata', async () => {
      const response = await request(app)
        .head(`/api/projects/${testProjectId}/buckets/test-bucket/files/test-file.txt`)
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.headers['content-length']).toBeDefined();
      expect(response.headers['etag']).toBeDefined();
    });

    it('GET /api/projects/:projectId/buckets/:bucketName/files should list files', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/buckets/test-bucket/files`)
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('files');
      expect(Array.isArray(response.body.files)).toBe(true);
    });

    it('DELETE /api/projects/:projectId/buckets/:bucketName/files/:key should delete file', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/buckets/test-bucket/files/test-file.txt`)
        .set(authHeader);

      expect(response.status).toBe(204);
    });
  });

  describe('Chunked Uploads API', () => {
    it('POST /api/projects/:projectId/buckets/:bucketName/files/:key/upload/initiate should initiate chunked upload', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/buckets/test-bucket/files/large-file.txt/upload/initiate`)
        .set(authHeader)
        .send({
          total_size: 10485760, // 10MB
          chunk_size: 5242880   // 5MB chunks
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('upload_id');
      expect(response.body).toHaveProperty('chunk_count', 2);
    });

    it('PUT /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/chunk/:chunkNumber should upload chunk', async () => {
      // First initiate upload
      const initiateResponse = await request(app)
        .post(`/api/projects/${testProjectId}/buckets/test-bucket/files/large-file.txt/upload/initiate`)
        .set(authHeader)
        .send({
          total_size: 10485760,
          chunk_size: 5242880
        });
      
      const uploadId = initiateResponse.body.upload_id;
      
      // Upload chunk
      const response = await request(app)
        .put(`/api/projects/${testProjectId}/buckets/test-bucket/files/large-file.txt/upload/${uploadId}/chunk/1`)
        .set(authHeader)
        .attach('chunk', Buffer.alloc(5242880, 'a'), 'chunk1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('chunk_number', 1);
    });

    it('GET /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/status should get upload status', async () => {
      // First initiate upload
      const initiateResponse = await request(app)
        .post(`/api/projects/${testProjectId}/buckets/test-bucket/files/large-file.txt/upload/initiate`)
        .set(authHeader)
        .send({
          total_size: 10485760,
          chunk_size: 5242880
        });
      
      const uploadId = initiateResponse.body.upload_id;
      
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/buckets/test-bucket/files/large-file.txt/upload/${uploadId}/status`)
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
    });
  });

  describe('Signed URLs API', () => {
    it('POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/upload should generate signed upload URL', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/buckets/test-bucket/files/signed-file.txt/signed-url/upload`)
        .set(authHeader)
        .send({
          ttl_seconds: 3600
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('expires_at');
    });

    it('POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/download should generate signed download URL', async () => {
      // First upload a file
      await request(app)
        .post(`/api/projects/${testProjectId}/buckets/test-bucket/files/signed-file.txt`)
        .set(authHeader)
        .attach('file', Buffer.from('test content'), 'signed-file.txt');

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/buckets/test-bucket/files/signed-file.txt/signed-url/download`)
        .set(authHeader)
        .send({
          ttl_seconds: 3600
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('expires_at');
    });

    it('GET /api/projects/:projectId/buckets/:bucketName/signed-urls should list signed URLs', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/buckets/test-bucket/signed-urls`)
        .set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('signed_urls');
      expect(Array.isArray(response.body.signed_urls)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/api/projects');

      expect(response.status).toBe(401);
    });

    it('should return 404 for nonexistent project', async () => {
      const response = await request(app)
        .get('/api/projects/nonexistent-id')
        .set(authHeader);

      expect(response.status).toBe(404);
    });

    it('should return 404 for nonexistent bucket', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/buckets/nonexistent-bucket`)
        .set(authHeader);

      expect(response.status).toBe(404);
    });

    it('should return 404 for nonexistent file', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/buckets/test-bucket/files/nonexistent-file.txt`)
        .set(authHeader);

      expect(response.status).toBe(404);
    });
  });
});
