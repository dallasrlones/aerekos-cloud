const TokenService = require('../../api/services/TokenService');
const TokenRepository = require('../../api/repos/TokenRepository');
const { Token } = require('../../api/models');
const { setupTestDatabase, cleanupTestData, createTestToken } = require('../helpers/dbHelper');
const { uniqueId } = require('../helpers/testHelpers');

describe('Token Service Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('TokenService.generateRegistrationToken', () => {
    test('should generate a new registration token', async () => {
      const token = await TokenService.generateRegistrationToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i); // UUID format
    });

    test('should store token in database', async () => {
      const token = await TokenService.generateRegistrationToken();
      const tokens = await Token.findAll({ where: { token } });

      expect(tokens.length).toBe(1);
      expect(tokens[0].token).toBe(token);
      expect(tokens[0].active).toBe(1); // SQLite: 1 = true
    });
  });

  describe('TokenService.validateToken', () => {
    test('should validate active token', async () => {
      const token = await TokenService.generateRegistrationToken();
      const isValid = await TokenService.validateToken(token);

      expect(isValid).toBe(true);
    });

    test('should reject non-existent token', async () => {
      const isValid = await TokenService.validateToken('non-existent-token');
      expect(isValid).toBe(false);
    });

    test('should reject inactive token', async () => {
      const token = await TokenService.generateRegistrationToken();
      await TokenRepository.invalidateToken(token);
      const isValid = await TokenService.validateToken(token);

      expect(isValid).toBe(false);
    });

    test('should reject expired token', async () => {
      const token = await TokenService.generateRegistrationToken();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() - 1); // 1 minute ago

      const tokens = await Token.findAll({ where: { token } });
      await Token.update(tokens[0].id, { expires_at: expiresAt.toISOString() });

      const isValid = await TokenService.validateToken(token);
      expect(isValid).toBe(false);
    });
  });

  describe('TokenService.getCurrentToken', () => {
    test('should return active token if exists', async () => {
      // Clean up any existing tokens first to ensure we get the one we create
      await TokenRepository.invalidateAllTokens();
      
      const token = await TokenService.generateRegistrationToken();
      const currentToken = await TokenService.getCurrentToken();

      expect(currentToken).toBe(token);
    });

    test('should return null if no active token', async () => {
      // All tokens are inactive
      const tokens = await Token.findAll();
      for (const token of tokens) {
        await Token.update(token.id, { active: 0 });
      }

      const currentToken = await TokenService.getCurrentToken();
      expect(currentToken).toBeNull();
    });
  });

  describe('TokenService.regenerateToken', () => {
    test('should create new token and invalidate old ones', async () => {
      const oldToken = await TokenService.generateRegistrationToken();
      const newToken = await TokenService.regenerateToken();

      expect(newToken).not.toBe(oldToken);
      expect(typeof newToken).toBe('string');

      // Old token should be invalidated
      const oldTokenValid = await TokenService.validateToken(oldToken);
      expect(oldTokenValid).toBe(false);

      // New token should be valid
      const newTokenValid = await TokenService.validateToken(newToken);
      expect(newTokenValid).toBe(true);
    });

    test('should return new token as current token', async () => {
      const newToken = await TokenService.regenerateToken();
      const currentToken = await TokenService.getCurrentToken();

      expect(currentToken).toBe(newToken);
    });
  });

  describe('TokenRepository', () => {
    test('should find active token', async () => {
      // Clean up any existing tokens first
      await TokenRepository.invalidateAllTokens();
      
      const token1 = await TokenService.generateRegistrationToken();
      await TokenRepository.invalidateToken(token1);
      const token2 = await TokenService.generateRegistrationToken();

      const activeToken = await TokenRepository.findActiveToken();
      expect(activeToken).not.toBeNull();
      expect(activeToken.token).toBe(token2);
      expect(activeToken.active).toBe(1);
    });

    test('should invalidate specific token', async () => {
      const token = await TokenService.generateRegistrationToken();
      await TokenRepository.invalidateToken(token);

      const tokens = await Token.findAll({ where: { token } });
      expect(tokens[0].active).toBe(0); // SQLite: 0 = false
    });

    test('should invalidate all tokens', async () => {
      await TokenService.generateRegistrationToken();
      await TokenService.generateRegistrationToken();
      const count = await TokenRepository.invalidateAllTokens();

      expect(count).toBeGreaterThan(0);

      const activeToken = await TokenRepository.findActiveToken();
      expect(activeToken).toBeNull();
    });
  });
});
