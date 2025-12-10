const request = require('supertest');
const app = require('../../index');
const UserService = require('../../api/services/UserService');
const JWTService = require('../../api/services/JWTService');
const { User } = require('../../api/models');
const { hashPassword } = require('../../api/utils/password');
const { setupTestDatabase, cleanupTestData, createTestUser } = require('../helpers/dbHelper');
const { uniqueId } = require('../helpers/testHelpers');

describe('Authentication Service Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('UserService.authenticate', () => {
    test('should authenticate user with correct password', async () => {
      const user = await createTestUser({
        password_hash: await hashPassword('testpassword')
      });

      const result = await UserService.authenticate(user.username, 'testpassword');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(user.id);
      expect(result.user.username).toBe(user.username);
      expect(result.user).not.toHaveProperty('password_hash'); // Should not expose password
    });

    test('should reject authentication with wrong password', async () => {
      const user = await createTestUser({
        password_hash: await hashPassword('correctpassword')
      });

      await expect(
        UserService.authenticate(user.username, 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    test('should reject authentication for non-existent user', async () => {
      await expect(
        UserService.authenticate('nonexistent', 'password')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('UserService.getCurrentUser', () => {
    test('should return user information', async () => {
      const user = await User.create({
        username: 'authtest',
        email: 'authtest@example.com',
        password_hash: await hashPassword('password'),
        role: 'admin'
      });

      const result = await UserService.getCurrentUser(user.id);

      expect(result).toHaveProperty('id', user.id);
      expect(result).toHaveProperty('username', 'authtest');
      expect(result).toHaveProperty('email', 'authtest@example.com');
      expect(result).toHaveProperty('role', 'admin');
      expect(result).not.toHaveProperty('password_hash');
    });

    test('should throw error for non-existent user', async () => {
      await expect(
        UserService.getCurrentUser('nonexistent-id')
      ).rejects.toThrow('User not found');
    });
  });

  describe('JWTService', () => {
    test('should generate valid JWT token', () => {
      const user = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      };

      const token = JWTService.generateToken(user);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('should verify valid JWT token', () => {
      const user = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      };

      const token = JWTService.generateToken(user);
      const decoded = JWTService.verifyToken(token);

      expect(decoded).toHaveProperty('id', '123');
      expect(decoded).toHaveProperty('username', 'testuser');
      expect(decoded).toHaveProperty('email', 'test@example.com');
      expect(decoded).toHaveProperty('role', 'admin');
    });

    test('should reject invalid JWT token', () => {
      expect(() => {
        JWTService.verifyToken('invalid-token');
      }).toThrow();
    });

    test('should decode token without verification', () => {
      const user = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      };

      const token = JWTService.generateToken(user);
      const decoded = JWTService.decodeToken(token);

      expect(decoded).toHaveProperty('id', '123');
      expect(decoded).toHaveProperty('username', 'testuser');
    });
  });
});
