const PID = '33333333-3333-3333-3333-333333333333';

const EncryptionService = require('../../../api/services/EncryptionService');
const axios = require('axios');
const { mockConductorUrl, mockServiceToken, createMockAxiosResponse, createMockAxiosError } = require('../../helpers/testHelpers');

jest.mock('axios');

describe('EncryptionService', () => {
  let encryptionService;

  beforeEach(() => {
    process.env.MOCK_KEY_MANAGER = 'true';
    encryptionService = new EncryptionService(mockConductorUrl, mockServiceToken);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MOCK_KEY_MANAGER;
  });

  describe('getEncryptionKey', () => {
    it('should return mock key when MOCK_KEY_MANAGER is true', async () => {
      const key = await encryptionService.getEncryptionKey('test-key', PID);

      expect(key).toHaveProperty('key_material');
      expect(key).toHaveProperty('key_version', 1);
      expect(key).toHaveProperty('algorithm', 'AES-256-GCM');
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should call key_manager API when MOCK_KEY_MANAGER is false', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      const mockKey = {
        key_material: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890', // 64 hex chars
        key_version: 1,
        algorithm: 'AES-256-GCM'
      };
      axios.get.mockResolvedValue(createMockAxiosResponse(mockKey));

      const key = await encryptionService.getEncryptionKey('test-key', PID);

      expect(key).toEqual(mockKey);
      expect(axios.get).toHaveBeenCalledWith(
        `${mockConductorUrl}/api/services/key_manager/api/keys/test-key?project_id=${encodeURIComponent(PID)}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockServiceToken}`
          }),
          timeout: 30000
        })
      );
    });

    it('should throw error if key_manager returns 404', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      axios.get.mockRejectedValue(createMockAxiosError(404, 'Key not found'));

      await expect(
        encryptionService.getEncryptionKey('nonexistent-key', PID)
      ).rejects.toThrow('not found');
    });

    it('should use default key name if not provided', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      const mockKey = {
        key_material: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
        key_version: 1,
        algorithm: 'AES-256-GCM'
      };
      axios.get.mockResolvedValue(createMockAxiosResponse(mockKey));

      await encryptionService.getEncryptionKey(undefined, PID);

      expect(axios.get).toHaveBeenCalledWith(
        `${mockConductorUrl}/api/services/key_manager/api/keys/db-manager-encryption-key?project_id=${encodeURIComponent(PID)}`,
        expect.any(Object)
      );
    });
  });

  describe('encryptData', () => {
    it('should encrypt data and return IV:authTag:encrypted format', async () => {
      const data = 'test connection string';
      const encrypted = await encryptionService.encryptData(data, 'test-key', PID);

      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0].length).toBe(32); // IV (16 bytes = 32 hex chars)
      expect(parts[1].length).toBe(32); // Auth tag (16 bytes = 32 hex chars)
    });

    it('should produce different encrypted data for same input (due to random IV)', async () => {
      const data = 'test data';
      const encrypted1 = await encryptionService.encryptData(data, 'test-key', PID);
      const encrypted2 = await encryptionService.encryptData(data, 'test-key', PID);

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should handle long connection strings', async () => {
      const longData = 'postgresql://user:password@host:5432/database?sslmode=require&connect_timeout=10';
      const encrypted = await encryptionService.encryptData(longData, 'test-key', PID);

      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });
  });

  describe('decryptData', () => {
    it('should decrypt encrypted data correctly', async () => {
      const originalData = 'postgresql://user:pass@host:5432/db';
      const encrypted = await encryptionService.encryptData(originalData, 'test-key', PID);
      const decrypted = await encryptionService.decryptData(encrypted, 'test-key', PID);

      expect(decrypted).toBe(originalData);
    });

    it('should throw error for invalid encrypted data format', async () => {
      const invalidData = 'invalid-format';

      await expect(
        encryptionService.decryptData(invalidData, 'test-key', PID)
      ).rejects.toThrow();
    });

    it('should throw error for corrupted encrypted data', async () => {
      const corruptedData = 'a'.repeat(32) + ':' + 'b'.repeat(32) + ':' + 'c'.repeat(32);

      await expect(
        encryptionService.decryptData(corruptedData, 'test-key', PID)
      ).rejects.toThrow();
    });
  });

  describe('ensureEncryptionKey', () => {
    it('should not call HTTP when MOCK_KEY_MANAGER is true', async () => {
      await encryptionService.ensureEncryptionKey('any-key', PID);
      expect(axios.get).not.toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should not create key if it already exists', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      const mockKey = {
        key_material: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
        key_version: 1,
        algorithm: 'AES-256-GCM'
      };
      axios.get.mockResolvedValue(createMockAxiosResponse(mockKey));

      await encryptionService.ensureEncryptionKey('existing-key', PID);

      expect(axios.get).toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should create key if it does not exist', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      axios.get.mockRejectedValue(createMockAxiosError(404, 'Key not found'));
      axios.post.mockResolvedValue(createMockAxiosResponse({
        id: 'new-key-id',
        name: 'new-key',
        type: 'symmetric',
        algorithm: 'AES-256-GCM'
      }));

      await encryptionService.ensureEncryptionKey('new-key', PID);

      expect(axios.post).toHaveBeenCalledWith(
        `${mockConductorUrl}/api/services/key_manager/api/keys?project_id=${encodeURIComponent(PID)}`,
        expect.objectContaining({
          name: 'new-key',
          type: 'symmetric',
          algorithm: 'AES-256-GCM'
        }),
        expect.any(Object)
      );
    });

    it('should throw error if key creation fails', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      axios.get.mockRejectedValue(createMockAxiosError(404, 'Key not found'));
      axios.post.mockRejectedValue(createMockAxiosError(500, 'Server error'));

      await expect(
        encryptionService.ensureEncryptionKey('new-key', PID)
      ).rejects.toThrow('Failed to create encryption key');
    });
  });
});
