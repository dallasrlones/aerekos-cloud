const { User, Worker, Service, Token } = require('../../api/models');
const { hashPassword } = require('../../api/utils/password');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestWorker, createTestService, createTestToken } = require('../helpers/dbHelper');
const { uniqueId, uniqueEmail } = require('../helpers/testHelpers');

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('User Model', () => {
    test('should create a user', async () => {
      const user = await createTestUser();

      expect(user).toHaveProperty('id');
      expect(user.username).toBeTruthy();
      expect(user.email).toBeTruthy();
      expect(user.role).toBe('user');
    });

    test('should find user by username', async () => {
      const createdUser = await createTestUser();
      const users = await User.findAll({ where: { username: createdUser.username } });
      
      expect(users.length).toBeGreaterThan(0);
      expect(users[0].username).toBe(createdUser.username);
    });

    test('should enforce unique username', async () => {
      const username = uniqueId('uniquetest');
      const firstUser = await createTestUser({ username });

      // Try to create duplicate username
      let errorThrown = false;
      try {
        await createTestUser({ username, email: uniqueEmail('different') });
      } catch (error) {
        errorThrown = true;
        // Should throw unique constraint error - check error message or code
        const errorMsg = error.message || '';
        const errorCode = error.code || '';
        expect(
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('duplicate') ||
          errorCode === 'SQLITE_CONSTRAINT_UNIQUE' ||
          errorCode === 'SQLITE_ERROR'
        ).toBe(true);
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe('Worker Model', () => {
    test('should create a worker', async () => {
      const worker = await createTestWorker();

      expect(worker).toHaveProperty('id');
      expect(worker.hostname).toBeTruthy();
      expect(worker.ip_address).toBeTruthy();
      expect(worker.status).toBe('online');
    });

    test('should find worker by hostname', async () => {
      const createdWorker = await createTestWorker();
      const workers = await Worker.findAll({ where: { hostname: createdWorker.hostname } });
      
      expect(workers.length).toBeGreaterThan(0);
      expect(workers[0].hostname).toBe(createdWorker.hostname);
    });
  });

  describe('Service Model', () => {
    test('should create a service', async () => {
      const service = await createTestService();

      expect(service).toHaveProperty('id');
      expect(service.name).toBeTruthy();
      expect(service.enabled).toBe(1);
    });

    test('should enforce unique service name', async () => {
      const serviceName = uniqueId('uniqueservice');
      const firstService = await createTestService({ name: serviceName });

      // Try to create duplicate name
      let errorThrown = false;
      try {
        await createTestService({ name: serviceName });
      } catch (error) {
        errorThrown = true;
        const errorMsg = error.message || '';
        const errorCode = error.code || '';
        expect(
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('duplicate') ||
          errorCode === 'SQLITE_CONSTRAINT_UNIQUE' ||
          errorCode === 'SQLITE_ERROR'
        ).toBe(true);
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe('Token Model', () => {
    test('should create a token', async () => {
      const token = await createTestToken();

      expect(token).toHaveProperty('id');
      expect(token.token).toBeTruthy();
      expect(token.active).toBe(1);
    });

    test('should find active tokens', async () => {
      await createTestToken();
      const tokens = await Token.findAll({ where: { active: 1 } });
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('should enforce unique token', async () => {
      const tokenValue = uniqueId('test-token');
      await createTestToken({ token: tokenValue });

      let errorThrown = false;
      try {
        await createTestToken({ token: tokenValue });
      } catch (error) {
        errorThrown = true;
        const errorMsg = error.message || '';
        const errorCode = error.code || '';
        expect(
          errorMsg.toLowerCase().includes('unique') ||
          errorMsg.toLowerCase().includes('duplicate') ||
          errorCode === 'SQLITE_CONSTRAINT_UNIQUE' ||
          errorCode === 'SQLITE_ERROR'
        ).toBe(true);
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe('Timestamps', () => {
    test('should automatically add created_at and updated_at', async () => {
      const user = await createTestUser();

      expect(user).toHaveProperty('created_at');
      expect(user).toHaveProperty('updated_at');
      expect(new Date(user.created_at)).toBeInstanceOf(Date);
    });
  });
});
