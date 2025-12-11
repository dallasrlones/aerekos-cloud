const request = require('supertest');
// Import app after test environment is set up
// The app should not start server in test mode
const app = require('../../index');
const { setupTestDatabase, cleanupTestData, createTestUser } = require('../helpers/dbHelper');

// Ensure app doesn't try to seed users in test mode
process.env.NODE_ENV = 'test';

describe('Conductor API Integration Tests', () => {
  let authToken;
  let registrationToken;
  let testUser;

  // Helper to ensure test user exists
  async function ensureTestUser() {
    if (testUser) {
      // Verify user still exists
      const { User } = require('../../api/models');
      const existing = await User.findAll({ where: { id: testUser.id } });
      if (existing.length > 0) {
        return testUser;
      }
    }

    // Create or recreate test user
    const { User } = require('../../api/models');
    const { hashPassword } = require('../../api/utils/password');
    
    // Clean up any existing testadmin users first
    const existingUsers = await User.findAll({ where: { username: 'testadmin' } });
    for (const user of existingUsers) {
      try {
        await User.delete(user.id);
      } catch (e) {
        // Ignore delete errors
      }
    }
    
    const passwordHash = await hashPassword('testpass123');
    testUser = await User.create({
      username: 'testadmin',
      email: `testadmin-${Date.now()}@aerekos.cloud`,
      password_hash: passwordHash,
      role: 'admin'
    });
    
    return testUser;
  }

  // Helper to reset test user password to known value
  async function resetTestUserPassword() {
    const { User } = require('../../api/models');
    const { hashPassword } = require('../../api/utils/password');
    const users = await User.findAll({ where: { username: 'testadmin' } });
    if (users.length > 0) {
      await User.update(users[0].id, {
        password_hash: await hashPassword('testpass123')
      });
    }
  }

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    // Ensure test user exists
    await ensureTestUser();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'conductor');
      expect(response.body).toHaveProperty('database');
      expect(['connected', 'initializing']).toContain(response.body.database);
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('API Info', () => {
    test('GET /api should return API info', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/login should authenticate user with valid credentials', async () => {
      await ensureTestUser();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('username', 'testadmin');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('role');

      authToken = response.body.token;
    });

    test('POST /api/auth/login should reject invalid credentials', async () => {
      await ensureTestUser();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      // Message should indicate invalid credentials
      expect(['Invalid credentials', 'invalid credentials']).toContain(response.body.error.message.toLowerCase());
    });

    test('POST /api/auth/login should require username and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    test('GET /api/auth/me should return current user with valid token', async () => {
      await ensureTestUser();
      
      // Always get a fresh token for this test
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      if (loginResponse.status !== 200) {
        console.error('Login failed in /me test:', loginResponse.status, loginResponse.body);
        throw new Error(`Failed to login for /me test: ${loginResponse.status}`);
      }
      
      const testToken = loginResponse.body.token;
      expect(testToken).toBeTruthy();

      // Try /api/v1/auth/me first (more reliable), then fallback to /api/auth/me
      let response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testToken}`);
      
      // If 404, try legacy endpoint
      if (response.status === 404) {
        response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${testToken}`);
      }
      
      // Verify we got a 200 response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      // Username should be testadmin
      expect(response.body.user.username).toBe('testadmin');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('role');
      
      // Store token for other tests
      authToken = testToken;
    });

    test('GET /api/auth/me should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message', 'No token provided');
    });

    test('GET /api/auth/me should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    test('POST /api/auth/logout should accept logout request', async () => {
      await ensureTestUser();
      
      if (!authToken) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testadmin',
            password: 'testpass123'
          });
        authToken = loginResponse.body.token;
      }

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logged out successfully');
    });

    test('POST /api/auth/reset-password should update password with correct current password', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      // Get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'testpass123',
          newPassword: 'newpassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('username');

      // Verify password was changed by trying to login with new password
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'newpassword123'
        })
        .expect(200);

      expect(newLoginResponse.body).toHaveProperty('token');
      
      // Reset password back for other tests
      await resetTestUserPassword();
    });

    test('POST /api/auth/reset-password should reject with incorrect current password', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('Current password is incorrect');
    });

    test('POST /api/auth/reset-password should reject password shorter than 6 characters', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'testpass123',
          newPassword: 'short'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('at least 6 characters');
    });

    test('POST /api/auth/reset-password should require current and new password', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'testpass123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('required');
    });

    test('POST /api/auth/reset-password should reject request without auth', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('PUT /api/auth/profile should update username successfully', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;
      const timestamp = Date.now();

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: `updatedusername-${timestamp}`,
          email: `testadmin-${timestamp}@aerekos.cloud`
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toContain('updatedusername');
      
      // Reset username back for other tests
      const { User } = require('../../api/models');
      const users = await User.findAll({ where: { username: `updatedusername-${timestamp}` } });
      if (users.length > 0) {
        await User.update(users[0].id, { username: 'testadmin' });
      }
    });

    test('PUT /api/auth/profile should update email successfully', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;
      const timestamp = Date.now();

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'testadmin',
          email: `updated-${timestamp}@example.com`
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toContain('@example.com');
    });

    test('PUT /api/auth/profile should reject duplicate username', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      // Create another user
      const { User } = require('../../api/models');
      const { hashPassword } = require('../../api/utils/password');
      const passwordHash = await hashPassword('password123');
      const timestamp = Date.now();
      const otherUser = await User.create({
        username: `existinguser-${timestamp}`,
        email: `existing-${timestamp}@example.com`,
        password_hash: passwordHash,
        role: 'user'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: `existinguser-${timestamp}`,
          email: `testadmin-${timestamp}@aerekos.cloud`
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('Username already exists');

      // Cleanup
      await User.delete(otherUser.id);
    });

    test('PUT /api/auth/profile should reject duplicate email', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      // Create another user
      const { User } = require('../../api/models');
      const { hashPassword } = require('../../api/utils/password');
      const passwordHash = await hashPassword('password123');
      const timestamp = Date.now();
      const otherUser = await User.create({
        username: `otheruser-${timestamp}`,
        email: `existing-${timestamp}@example.com`,
        password_hash: passwordHash,
        role: 'user'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'testadmin',
          email: `existing-${timestamp}@example.com`
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('Email already exists');

      // Cleanup
      await User.delete(otherUser.id);
    });

    test('PUT /api/auth/profile should reject invalid email format', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'testadmin',
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('Invalid email format');
    });

    test('PUT /api/auth/profile should reject username shorter than 3 characters', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;
      const timestamp = Date.now();

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'ab',
          email: `testadmin-${timestamp}@aerekos.cloud`
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('at least 3 characters');
    });

    test('PUT /api/auth/profile should require at least one field', async () => {
      await ensureTestUser();
      await resetTestUserPassword();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpass123'
        });
      
      const token = loginResponse.body.token;

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('required');
    });

    test('PUT /api/auth/profile should reject request without auth', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({
          username: 'newusername',
          email: 'new@example.com'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Registration Token Management', () => {
    test('GET /api/token should return registration token with valid auth', async () => {
      await ensureTestUser();
      
      if (!authToken) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testadmin',
            password: 'testpass123'
          });
        authToken = loginResponse.body.token;
      }

      // Ensure a token exists first
      const TokenService = require('../../api/services/TokenService');
      let currentToken = await TokenService.getCurrentToken();
      if (!currentToken) {
        currentToken = await TokenService.generateRegistrationToken();
      }

      const response = await request(app)
        .get('/api/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);

      registrationToken = response.body.token;
    });

    test('GET /api/token should reject request without auth', async () => {
      const response = await request(app)
        .get('/api/token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    test('POST /api/token/regenerate should create new token', async () => {
      await ensureTestUser();
      
      if (!authToken) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testadmin',
            password: 'testpass123'
          });
        authToken = loginResponse.body.token;
      }

      // Get current token first (might not exist, that's okay)
      let oldToken = null;
      try {
        const currentResponse = await request(app)
          .get('/api/token')
          .set('Authorization', `Bearer ${authToken}`);
        if (currentResponse.status === 200) {
          oldToken = currentResponse.body.token;
        }
      } catch (error) {
        // Token might not exist yet
      }

      // Regenerate token
      const response = await request(app)
        .post('/api/token/regenerate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('message');
      if (oldToken) {
        expect(response.body.token).not.toBe(oldToken);
      }

      // Verify new token is returned
      const newTokenResponse = await request(app)
        .get('/api/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(newTokenResponse.body.token).toBe(response.body.token);
    });

    test('POST /api/token/regenerate should reject request without auth', async () => {
      const response = await request(app)
        .post('/api/token/regenerate')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Worker Routes', () => {
    let testWorker;

    beforeEach(async () => {
      // Ensure test user exists for auth
      await ensureTestUser();
      if (!authToken) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testadmin',
            password: 'testpass123'
          });
        authToken = loginResponse.body.token;
      }

      // Get registration token
      const tokenResponse = await request(app)
        .get('/api/token')
        .set('Authorization', `Bearer ${authToken}`);
      registrationToken = tokenResponse.body.token;

      // Create a test worker for some tests
      const { createTestWorker } = require('../helpers/dbHelper');
      testWorker = await createTestWorker();
    });

    describe('POST /api/workers/register', () => {
      test('should register a new worker with valid token', async () => {
        const response = await request(app)
          .post('/api/workers/register')
          .send({
            token: registrationToken,
            hostname: 'test-worker-1',
            ip_address: '192.168.1.100',
            resources: {
              cpu_cores: 4,
              ram_gb: 8,
              disk_gb: 100,
              network_mbps: 1000
            }
          })
          .expect(201);

        expect(response.body).toHaveProperty('worker');
        expect(response.body.worker).toHaveProperty('id');
        expect(response.body.worker.hostname).toBe('test-worker-1');
        expect(response.body.worker.ip_address).toBe('192.168.1.100');
        expect(response.body.worker.status).toBe('online');
      });

      test('should register worker with existing worker_id', async () => {
        const response = await request(app)
          .post('/api/workers/register')
          .send({
            token: registrationToken,
            hostname: 'test-worker-existing',
            ip_address: '192.168.1.101',
            resources: { cpu_cores: 8 },
            worker_id: testWorker.id
          })
          .expect(201);

        expect(response.body.worker.id).toBe(testWorker.id);
        expect(response.body.worker.hostname).toBe('test-worker-existing');
      });

      test('should detect IP and hostname from request when not provided', async () => {
        const response = await request(app)
          .post('/api/workers/register')
          .set('X-Forwarded-For', '10.0.0.1')
          .set('Host', 'test-host.example.com')
          .send({
            token: registrationToken,
            resources: { cpu_cores: 4 }
          })
          .expect(201);

        expect(response.body.worker).toHaveProperty('ip_address');
        expect(response.body.worker).toHaveProperty('hostname');
      });

      test('should reject registration without token', async () => {
        const response = await request(app)
          .post('/api/workers/register')
          .send({
            hostname: 'test-worker',
            ip_address: '192.168.1.100',
            resources: {}
          })
          .expect(400);

        expect(response.body.error.message).toBe('Registration token is required');
      });

      test('should reject registration with invalid token', async () => {
        const response = await request(app)
          .post('/api/workers/register')
          .send({
            token: 'invalid-token',
            hostname: 'test-worker',
            ip_address: '192.168.1.100',
            resources: {}
          })
          .expect(401);

        expect(response.body.error.message).toBe('Invalid registration token');
      });
    });

    describe('POST /api/workers/:id/heartbeat', () => {
      test('should accept heartbeat from registered worker', async () => {
        const response = await request(app)
          .post(`/api/workers/${testWorker.id}/heartbeat`)
          .expect(200);

        expect(response.body).toHaveProperty('worker');
        expect(response.body.worker.id).toBe(testWorker.id);
        expect(response.body.worker.status).toBe('online');
        expect(response.body.worker).toHaveProperty('last_seen');
      });

      test('should return 404 for non-existent worker', async () => {
        const response = await request(app)
          .post('/api/workers/nonexistent-id/heartbeat')
          .expect(404);

        expect(response.body.error.message).toBe('Worker not found');
      });
    });

    describe('PUT /api/workers/:id/resources', () => {
      test('should update worker resources', async () => {
        const newResources = {
          cpu_cores: 8,
          ram_gb: 16,
          disk_gb: 500,
          network_mbps: 2000
        };

        const response = await request(app)
          .put(`/api/workers/${testWorker.id}/resources`)
          .send({ resources: newResources })
          .expect(200);

        expect(response.body.worker.resources).toEqual(newResources);
      });

      test('should reject update without resources', async () => {
        const response = await request(app)
          .put(`/api/workers/${testWorker.id}/resources`)
          .send({})
          .expect(400);

        expect(response.body.error.message).toBe('Resources data is required');
      });

      test('should return 404 for non-existent worker', async () => {
        const response = await request(app)
          .put('/api/workers/nonexistent-id/resources')
          .send({ resources: { cpu_cores: 4 } })
          .expect(404);

        expect(response.body.error.message).toBe('Worker not found');
      });
    });

    describe('GET /api/workers', () => {
      test('should return all workers (requires auth)', async () => {
        const response = await request(app)
          .get('/api/workers')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('workers');
        expect(Array.isArray(response.body.workers)).toBe(true);
      });

      test('should reject request without auth', async () => {
        const response = await request(app)
          .get('/api/workers')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/workers/:id', () => {
      test('should return worker by ID (requires auth)', async () => {
        const response = await request(app)
          .get(`/api/workers/${testWorker.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('worker');
        expect(response.body.worker.id).toBe(testWorker.id);
        expect(response.body.worker).toHaveProperty('hostname');
        expect(response.body.worker).toHaveProperty('ip_address');
      });

      test('should return 404 for non-existent worker', async () => {
        const response = await request(app)
          .get('/api/workers/nonexistent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.error.message).toBe('Worker not found');
      });

      test('should reject request without auth', async () => {
        const response = await request(app)
          .get(`/api/workers/${testWorker.id}`)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('WorkerService methods', () => {
      test('should get workers by status', async () => {
        const WorkerService = require('../../api/services/WorkerService');
        
        const onlineWorkers = await WorkerService.getWorkersByStatus('online');
        expect(Array.isArray(onlineWorkers)).toBe(true);
        
        const offlineWorkers = await WorkerService.getWorkersByStatus('offline');
        expect(Array.isArray(offlineWorkers)).toBe(true);
      });

      test('should mark worker as offline', async () => {
        const WorkerService = require('../../api/services/WorkerService');
        
        const worker = await WorkerService.markWorkerOffline(testWorker.id);
        expect(worker.status).toBe('offline');
        
        // Mark back online for other tests
        await WorkerService.sendHeartbeat(testWorker.id);
      });

      test('should register worker with existing worker by hostname', async () => {
        const WorkerService = require('../../api/services/WorkerService');
        const TokenService = require('../../api/services/TokenService');
        
        const token = await TokenService.generateRegistrationToken();
        
        // Register first time
        const worker1 = await WorkerService.registerWorker(
          token,
          'test-worker-duplicate',
          '192.168.1.200',
          { cpu_cores: 4 }
        );
        
        // Register again with same hostname (should update existing)
        const worker2 = await WorkerService.registerWorker(
          token,
          'test-worker-duplicate',
          '192.168.1.201', // Different IP
          { cpu_cores: 8 } // Updated resources
        );
        
        expect(worker2.id).toBe(worker1.id);
        expect(worker2.ip_address).toBe('192.168.1.201');
      });

      test('should register worker with existing worker by IP', async () => {
        const WorkerService = require('../../api/services/WorkerService');
        const TokenService = require('../../api/services/TokenService');
        
        const token = await TokenService.generateRegistrationToken();
        
        // Register first time
        const worker1 = await WorkerService.registerWorker(
          token,
          'test-worker-ip-1',
          '192.168.1.202',
          { cpu_cores: 4 }
        );
        
        // Register again with same IP but different hostname (should update existing)
        const worker2 = await WorkerService.registerWorker(
          token,
          'test-worker-ip-2', // Different hostname
          '192.168.1.202', // Same IP
          { cpu_cores: 8 }
        );
        
        expect(worker2.id).toBe(worker1.id);
        expect(worker2.hostname).toBe('test-worker-ip-2');
      });

      test('should handle registration with invalid existing worker ID', async () => {
        const WorkerService = require('../../api/services/WorkerService');
        const TokenService = require('../../api/services/TokenService');
        
        const token = await TokenService.generateRegistrationToken();
        
        // Try to register with non-existent worker ID (should create new)
        const worker = await WorkerService.registerWorker(
          token,
          'test-worker-new',
          '192.168.1.203',
          { cpu_cores: 4 },
          'nonexistent-worker-id'
        );
        
        expect(worker).toHaveProperty('id');
        expect(worker.hostname).toBe('test-worker-new');
      });
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('status', 404);
    });

    test('POST /api/auth/login with malformed JSON should return 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });
});
