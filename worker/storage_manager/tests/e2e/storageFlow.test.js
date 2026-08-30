const request = require('supertest');
const express = require('express');
const { setupTestEnvironment, teardownTestEnvironment } = require('../helpers/setup');
const { getDatabase } = require('../../api/utils/dbClient');
const { initializeModels } = require('../../api/models');

// Import routes
const projectRoutes = require('../../api/routes/projects');
const bucketRoutes = require('../../api/routes/buckets');
const chunkedUploadRoutes = require('../../api/routes/chunkedUploads');
const signedUrlRoutes = require('../../api/routes/signedUrls');
const fileRoutes = require('../../api/routes/files');

let app;

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
  
  process.env.SERVICE_TOKEN = 'test-token';
});

afterAll(async () => {
  await teardownTestEnvironment();
});

describe('End-to-End Storage Flow', () => {
  const authHeader = { Authorization: 'Bearer test-token' };
  let projectId;
  let bucketName = 'e2e-test-bucket';

  it('should complete full storage workflow', async () => {
    // 1. Create project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set(authHeader)
      .send({ name: 'e2e-test-project' });
    
    expect(projectResponse.status).toBe(201);
    projectId = projectResponse.body.id;

    // 2. Create bucket
    const bucketResponse = await request(app)
      .post(`/api/projects/${projectId}/buckets`)
      .set(authHeader)
      .send({ name: bucketName });
    
    expect(bucketResponse.status).toBe(201);

    // 3. Upload file
    const uploadResponse = await request(app)
      .post(`/api/projects/${projectId}/buckets/${bucketName}/files/e2e-test-file.txt`)
      .set(authHeader)
      .attach('file', Buffer.from('E2E test file content'), 'e2e-test-file.txt');
    
    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.key).toBe('e2e-test-file.txt');

    // 4. List files
    const listResponse = await request(app)
      .get(`/api/projects/${projectId}/buckets/${bucketName}/files`)
      .set(authHeader);
    
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.files.length).toBeGreaterThan(0);

    // 5. Download file
    const downloadResponse = await request(app)
      .get(`/api/projects/${projectId}/buckets/${bucketName}/files/e2e-test-file.txt`)
      .set(authHeader);
    
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.text).toBe('E2E test file content');

    // 6. Get file metadata
    const metadataResponse = await request(app)
      .head(`/api/projects/${projectId}/buckets/${bucketName}/files/e2e-test-file.txt`)
      .set(authHeader);
    
    expect(metadataResponse.status).toBe(200);
    expect(metadataResponse.headers['content-length']).toBeDefined();

    // 7. Delete file
    const deleteResponse = await request(app)
      .delete(`/api/projects/${projectId}/buckets/${bucketName}/files/e2e-test-file.txt`)
      .set(authHeader);
    
    expect(deleteResponse.status).toBe(204);

    // 8. Verify file is deleted
    const verifyResponse = await request(app)
      .get(`/api/projects/${projectId}/buckets/${bucketName}/files/e2e-test-file.txt`)
      .set(authHeader);
    
    expect(verifyResponse.status).toBe(404);

    // 9. Delete bucket
    const deleteBucketResponse = await request(app)
      .delete(`/api/projects/${projectId}/buckets/${bucketName}`)
      .set(authHeader);
    
    expect(deleteBucketResponse.status).toBe(204);

    // 10. Delete project
    const deleteProjectResponse = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set(authHeader);
    
    expect(deleteProjectResponse.status).toBe(204);
  });

  it('should handle encryption/decryption flow', async () => {
    // Create project and bucket
    const projectResponse = await request(app)
      .post('/api/projects')
      .set(authHeader)
      .send({ name: 'encryption-test-project' });
    projectId = projectResponse.body.id;

    const bucketResponse = await request(app)
      .post(`/api/projects/${projectId}/buckets`)
      .set(authHeader)
      .send({ name: 'encryption-test-bucket' });
    
    const originalContent = 'This is encrypted test content';
    
    // Upload file (should be encrypted)
    const uploadResponse = await request(app)
      .post(`/api/projects/${projectId}/buckets/encryption-test-bucket/files/encrypted-file.txt`)
      .set(authHeader)
      .attach('file', Buffer.from(originalContent), 'encrypted-file.txt');
    
    expect(uploadResponse.status).toBe(200);

    // Download file (should be decrypted)
    const downloadResponse = await request(app)
      .get(`/api/projects/${projectId}/buckets/encryption-test-bucket/files/encrypted-file.txt`)
      .set(authHeader);
    
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.text).toBe(originalContent);
  });

  it('should handle large file uploads via chunked upload', async () => {
    // Create project and bucket
    const projectResponse = await request(app)
      .post('/api/projects')
      .set(authHeader)
      .send({ name: 'chunked-test-project' });
    projectId = projectResponse.body.id;

    const bucketResponse = await request(app)
      .post(`/api/projects/${projectId}/buckets`)
      .set(authHeader)
      .send({ name: 'chunked-test-bucket' });

    // Initiate chunked upload
    const initiateResponse = await request(app)
      .post(`/api/projects/${projectId}/buckets/chunked-test-bucket/files/large-file.bin/upload/initiate`)
      .set(authHeader)
      .send({
        total_size: 10485760, // 10MB
        chunk_size: 5242880   // 5MB chunks
      });
    
    expect(initiateResponse.status).toBe(201);
    const uploadId = initiateResponse.body.upload_id;
    const chunkCount = initiateResponse.body.chunk_count;

    // Upload chunks
    for (let i = 1; i <= chunkCount; i++) {
      const chunkResponse = await request(app)
        .put(`/api/projects/${projectId}/buckets/chunked-test-bucket/files/large-file.bin/upload/${uploadId}/chunk/${i}`)
        .set(authHeader)
        .attach('chunk', Buffer.alloc(5242880, i), `chunk${i}`);
      
      expect(chunkResponse.status).toBe(200);
    }

    // Complete upload
    const completeResponse = await request(app)
      .post(`/api/projects/${projectId}/buckets/chunked-test-bucket/files/large-file.bin/upload/${uploadId}/complete`)
      .set(authHeader)
      .send({ chunk_etags: [] });
    
    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body).toHaveProperty('file_id');
  });
});
