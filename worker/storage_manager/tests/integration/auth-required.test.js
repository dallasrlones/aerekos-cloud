process.env.AUTH_REQUIRED = 'true';
process.env.AUTH_MANAGER_URL = '';

const request = require('supertest');
const express = require('express');
const projectRoutes = require('../../api/routes/projects');

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

describe('storage_manager AUTH_REQUIRED', () => {
  test('rejects unauthenticated requests when AUTH_REQUIRED=true', async () => {
    const response = await request(app).get('/api/projects');
    expect(response.status).toBe(401);
    expect(response.body.error?.message).toMatch(/authentication required/i);
  });
});
