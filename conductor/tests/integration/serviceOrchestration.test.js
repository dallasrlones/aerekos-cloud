const request = require('supertest');
const app = require('../../index');
const { setupTestDatabase, cleanupTestData, createTestUser } = require('../helpers/dbHelper');
const { User, Project, Service, Worker, ProjectWorker, ProjectService } = require('../../api/models');
const { hashPassword } = require('../../api/utils/password');

// Ensure app doesn't try to seed users in test mode
process.env.NODE_ENV = 'test';

describe('Service Orchestration API', () => {
  let authToken;
  let testProject;
  let testService;
  let testWorker;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    // Create test user
    const passwordHash = await hashPassword('testpass123');
    const user = await User.create({
      username: 'testadmin',
      password_hash: passwordHash,
      email: 'testadmin@example.com',
      role: 'admin'
    });

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'testpass123' });
    
    authToken = loginResponse.body.token;

    // Create test project
    testProject = await Project.create({
      name: `test-project-${Date.now()}`,
      description: 'Test project',
      enabled: 1,
      config: '{}'
    });

    // Create test service
    testService = await Service.create({
      name: 'ai_manager',
      description: 'Test AI manager service',
      enabled: 1,
      docker_image: 'aerekos-ai_manager:latest',
      config: '{}'
    });

    // Create test worker
    testWorker = await Worker.create({
      hostname: `test-worker-${Date.now()}`,
      ip_address: '192.168.1.100',
      status: 'online'
    });

    // Assign worker to project
    await ProjectWorker.create({
      project_id: testProject.id,
      worker_id: testWorker.id
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('POST /api/projects/:projectId/services/:serviceId/enable', () => {
    it('should enable service for project and trigger auto-deployment', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/services/${testService.id}/enable`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projectId).toBe(testProject.id);
      expect(response.body.serviceId).toBe(testService.id);
      expect(response.body.enabled).toBe(true);
      expect(response.body.deployments).toBeDefined();
      expect(Array.isArray(response.body.deployments)).toBe(true);

      // Verify ProjectService was created/updated
      const projectServices = await ProjectService.findAll({
        where: {
          project_id: testProject.id,
          service_id: testService.id
        }
      });
      expect(projectServices.length).toBeGreaterThan(0);
      expect(projectServices[0].enabled).toBe(1);
    });

    it('should return 404 if project not found', async () => {
      const fakeProjectId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/projects/${fakeProjectId}/services/${testService.id}/enable`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('Project not found');
    });

    it('should return 404 if service not found', async () => {
      const fakeServiceId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/services/${fakeServiceId}/enable`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('Service not found');
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/projects/${testProject.id}/services/${testService.id}/enable`)
        .expect(401);
    });
  });

  describe('POST /api/projects/:projectId/services/:serviceId/disable', () => {
    beforeEach(async () => {
      // Ensure service is enabled first
      const projectServices = await ProjectService.findAll({
        where: {
          project_id: testProject.id,
          service_id: testService.id
        }
      });
      if (projectServices.length === 0) {
        await ProjectService.create({
          project_id: testProject.id,
          service_id: testService.id,
          enabled: 1,
          config: '{}',
          scaling_policy: '{}'
        });
      } else {
        await ProjectService.update(projectServices[0].id, { enabled: 1 });
      }
    });

    it('should disable service for project and stop deployments', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/services/${testService.id}/disable`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projectId).toBe(testProject.id);
      expect(response.body.serviceId).toBe(testService.id);
      expect(response.body.enabled).toBe(false);
      expect(response.body.stoppedDeployments).toBeDefined();

      // Verify ProjectService was disabled
      const projectServices = await ProjectService.findAll({
        where: {
          project_id: testProject.id,
          service_id: testService.id
        }
      });
      expect(projectServices.length).toBeGreaterThan(0);
      expect(projectServices[0].enabled).toBe(0);
    });

    it('should return 404 if project not found', async () => {
      const fakeProjectId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/projects/${fakeProjectId}/services/${testService.id}/disable`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('Project not found');
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/projects/${testProject.id}/services/${testService.id}/disable`)
        .expect(401);
    });
  });

  describe('PUT /api/projects/:projectId/services/:serviceId/config', () => {
    it('should update service config for project', async () => {
      const config = { port: 3002, env: { NODE_ENV: 'production' } };
      const response = await request(app)
        .put(`/api/projects/${testProject.id}/services/${testService.id}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ config })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projectId).toBe(testProject.id);
      expect(response.body.serviceId).toBe(testService.id);
      expect(response.body.config).toEqual(config);

      // Verify config was saved
      const projectServices = await ProjectService.findAll({
        where: {
          project_id: testProject.id,
          service_id: testService.id
        }
      });
      expect(projectServices.length).toBeGreaterThan(0);
      const savedConfig = JSON.parse(projectServices[0].config);
      expect(savedConfig.port).toBe(3002);
    });

    it('should return 400 if config is not an object', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProject.id}/services/${testService.id}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ config: 'not an object' })
        .expect(400);

      expect(response.body.error.message).toBe('Config must be a valid JSON object');
    });

    it('should create ProjectService if it does not exist', async () => {
      // Delete existing ProjectService
      const projectServices = await ProjectService.findAll({
        where: {
          project_id: testProject.id,
          service_id: testService.id
        }
      });
      for (const ps of projectServices) {
        await ProjectService.delete(ps.id);
      }

      const config = { port: 3003 };
      const response = await request(app)
        .put(`/api/projects/${testProject.id}/services/${testService.id}/config`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ config })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify ProjectService was created
      const newProjectServices = await ProjectService.findAll({
        where: {
          project_id: testProject.id,
          service_id: testService.id
        }
      });
      expect(newProjectServices.length).toBe(1);
    });
  });

  describe('PUT /api/projects/:projectId/services/:serviceId/scaling', () => {
    it('should update scaling policy for project', async () => {
      const scalingPolicy = {
        min_instances: 2,
        max_instances: 5,
        target_cpu: 75
      };
      const response = await request(app)
        .put(`/api/projects/${testProject.id}/services/${testService.id}/scaling`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(scalingPolicy)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projectId).toBe(testProject.id);
      expect(response.body.serviceId).toBe(testService.id);
      expect(response.body.scalingPolicy.min_instances).toBe(2);
      expect(response.body.scalingPolicy.max_instances).toBe(5);
      expect(response.body.scalingPolicy.target_cpu).toBe(75);
      // Should have defaults merged
      expect(response.body.scalingPolicy.target_memory).toBe(80);

      // Verify scaling policy was saved
      const projectServices = await ProjectService.findAll({
        where: {
          project_id: testProject.id,
          service_id: testService.id
        }
      });
      expect(projectServices.length).toBeGreaterThan(0);
      const savedPolicy = JSON.parse(projectServices[0].scaling_policy);
      expect(savedPolicy.min_instances).toBe(2);
      expect(savedPolicy.max_instances).toBe(5);
    });

    it('should return 400 if scaling policy is not an object', async () => {
      // Send an array instead of an object to test validation
      const response = await request(app)
        .put(`/api/projects/${testProject.id}/services/${testService.id}/scaling`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send([1, 2, 3]) // Send array to test validation
        .expect(400);

      expect(response.body.error.message).toBe('Scaling policy must be a valid JSON object');
    });

    it('should merge with default scaling policy values', async () => {
      const scalingPolicy = {
        min_instances: 3
      };
      const response = await request(app)
        .put(`/api/projects/${testProject.id}/services/${testService.id}/scaling`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(scalingPolicy)
        .expect(200);

      // Should have defaults for other fields
      expect(response.body.scalingPolicy.max_instances).toBe(10);
      expect(response.body.scalingPolicy.target_cpu).toBe(70);
      expect(response.body.scalingPolicy.target_memory).toBe(80);
    });
  });

  describe('GET /api/projects/:projectId/services/:serviceId/assignments', () => {
    it('should get service assignments and load distribution', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/services/${testService.id}/assignments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projectId).toBe(testProject.id);
      expect(response.body.serviceId).toBe(testService.id);
      expect(response.body.distribution).toBeDefined();
      expect(response.body.distribution.totalInstances).toBeDefined();
      expect(response.body.pinning).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/projects/${testProject.id}/services/${testService.id}/assignments`)
        .expect(401);
    });
  });

  describe('GET /api/projects/:projectId/services/:serviceId/load-balancer/statistics', () => {
    it('should get load balancer statistics', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProject.id}/services/${testService.id}/load-balancer/statistics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projectId).toBe(testProject.id);
      expect(response.body.serviceId).toBe(testService.id);
      expect(response.body.algorithm).toBeDefined();
      expect(response.body.totalInstances).toBeDefined();
      expect(response.body.healthyInstances).toBeDefined();
      expect(response.body.unhealthyInstances).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/projects/${testProject.id}/services/${testService.id}/load-balancer/statistics`)
        .expect(401);
    });
  });
});
