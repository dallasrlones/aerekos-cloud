const request = require('supertest');
const app = require('../../index');
const UserService = require('../../api/services/UserService');
const JWTService = require('../../api/services/JWTService');
const { User } = require('../../api/models');
const { hashPassword, comparePassword } = require('../../api/utils/password');
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

  describe('UserService.updatePassword', () => {
    test('should update password with correct current password', async () => {
      const user = await createTestUser({
        password_hash: await hashPassword('oldpassword123')
      });

      const result = await UserService.updatePassword(
        user.id,
        'oldpassword123',
        'newpassword123'
      );

      expect(result).toHaveProperty('id', user.id);
      expect(result).toHaveProperty('username', user.username);
      expect(result).toHaveProperty('email', user.email);
      expect(result).not.toHaveProperty('password_hash');

      // Verify password was actually changed
      const updatedUser = await User.findAll({ where: { id: user.id } });
      const passwordMatch = await comparePassword('newpassword123', updatedUser[0].password_hash);
      expect(passwordMatch).toBe(true);
    });

    test('should reject update with incorrect current password', async () => {
      const user = await createTestUser({
        password_hash: await hashPassword('correctpassword')
      });

      await expect(
        UserService.updatePassword(user.id, 'wrongpassword', 'newpassword123')
      ).rejects.toThrow('Current password is incorrect');
    });

    test('should reject update with password shorter than 6 characters', async () => {
      const user = await createTestUser({
        password_hash: await hashPassword('oldpassword123')
      });

      await expect(
        UserService.updatePassword(user.id, 'oldpassword123', 'short')
      ).rejects.toThrow('must be at least 6 characters');
    });

    test('should reject update for non-existent user', async () => {
      await expect(
        UserService.updatePassword('nonexistent-id', 'password', 'newpassword123')
      ).rejects.toThrow('User not found');
    });
  });

  describe('UserService.updateProfile', () => {
    test('should update username successfully', async () => {
      const user = await createTestUser({
        username: 'oldusername',
        email: 'old@example.com'
      });

      const result = await UserService.updateProfile(user.id, {
        username: 'newusername',
        email: user.email
      });

      expect(result).toHaveProperty('id', user.id);
      expect(result).toHaveProperty('username', 'newusername');
      expect(result).toHaveProperty('email', 'old@example.com');

      // Verify username was actually changed
      const updatedUser = await User.findAll({ where: { id: user.id } });
      expect(updatedUser[0].username).toBe('newusername');
    });

    test('should update email successfully', async () => {
      const timestamp = Date.now();
      const user = await createTestUser({
        username: `testuser-${timestamp}`,
        email: `old-${timestamp}@example.com`
      });

      const result = await UserService.updateProfile(user.id, {
        username: user.username,
        email: `new-${timestamp}@example.com`
      });

      expect(result).toHaveProperty('id', user.id);
      expect(result).toHaveProperty('username', user.username);
      expect(result).toHaveProperty('email', `new-${timestamp}@example.com`);

      // Verify email was actually changed
      const updatedUser = await User.findAll({ where: { id: user.id } });
      expect(updatedUser[0].email).toBe(`new-${timestamp}@example.com`);
    });

    test('should update both username and email', async () => {
      const timestamp = Date.now();
      const user = await createTestUser({
        username: `oldusername-${timestamp}`,
        email: `old-${timestamp}@example.com`
      });

      const result = await UserService.updateProfile(user.id, {
        username: `newusername-${timestamp}`,
        email: `new-${timestamp}@example.com`
      });

      expect(result).toHaveProperty('username', `newusername-${timestamp}`);
      expect(result).toHaveProperty('email', `new-${timestamp}@example.com`);
    });

    test('should reject update with duplicate username', async () => {
      const user1 = await createTestUser({ username: 'existinguser' });
      const user2 = await createTestUser({ username: 'otheruser' });

      await expect(
        UserService.updateProfile(user2.id, {
          username: 'existinguser',
          email: user2.email
        })
      ).rejects.toThrow('Username already exists');
    });

    test('should reject update with duplicate email', async () => {
      const user1 = await createTestUser({ email: 'existing@example.com' });
      const user2 = await createTestUser({ email: 'other@example.com' });

      await expect(
        UserService.updateProfile(user2.id, {
          username: user2.username,
          email: 'existing@example.com'
        })
      ).rejects.toThrow('Email already exists');
    });

    test('should reject update with invalid email format', async () => {
      const user = await createTestUser();

      await expect(
        UserService.updateProfile(user.id, {
          username: user.username,
          email: 'invalid-email'
        })
      ).rejects.toThrow('Invalid email format');
    });

    test('should reject update with username shorter than 3 characters', async () => {
      const user = await createTestUser();

      await expect(
        UserService.updateProfile(user.id, {
          username: 'ab',
          email: user.email
        })
      ).rejects.toThrow('must be at least 3 characters');
    });

    test('should reject update with empty username', async () => {
      const user = await createTestUser();

      await expect(
        UserService.updateProfile(user.id, {
          username: '',
          email: user.email
        })
      ).rejects.toThrow('Username cannot be empty');
    });

    test('should reject update with empty email', async () => {
      const user = await createTestUser();

      await expect(
        UserService.updateProfile(user.id, {
          username: user.username,
          email: ''
        })
      ).rejects.toThrow('Email cannot be empty');
    });

    test('should return current user if no changes provided', async () => {
      const user = await createTestUser({
        username: 'testuser',
        email: 'test@example.com'
      });

      const result = await UserService.updateProfile(user.id, {
        username: 'testuser',
        email: 'test@example.com'
      });

      expect(result).toHaveProperty('username', 'testuser');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    test('should reject update for non-existent user', async () => {
      await expect(
        UserService.updateProfile('nonexistent-id', {
          username: 'newusername',
          email: 'new@example.com'
        })
      ).rejects.toThrow('User not found');
    });
  });
});
