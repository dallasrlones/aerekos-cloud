const EncryptionService = require('../../../api/services/EncryptionService');
const axios = require('axios');

jest.mock('axios');

describe('EncryptionService', () => {
  let encryptionService;
  const mockConductorUrl = 'http://localhost:3000';
  const mockServiceToken = 'test-token';
  const projectId = 'proj-test-001';

  beforeEach(() => {
    process.env.MOCK_KEY_MANAGER = 'true';
    delete process.env.MOCK_KEY_MATERIAL;
    encryptionService = new EncryptionService(mockConductorUrl, mockServiceToken);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEncryptionKey', () => {
    it('should return mock key when MOCK_KEY_MANAGER is true', async () => {
      const key = await encryptionService.getEncryptionKey('test-key', projectId);

      expect(key).toHaveProperty('key_material');
      expect(key).toHaveProperty('key_version');
      expect(key).toHaveProperty('algorithm');
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should use a global key (no project_id param) when projectId is null', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      const mockKey = {
        key_material: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        key_version: 1,
        algorithm: 'AES-256-GCM'
      };
      axios.get.mockResolvedValue({ data: mockKey });

      const key = await encryptionService.getEncryptionKey('test-key', null);

      expect(key).toEqual(mockKey);
      // No project_id query param for system/global keys
      expect(axios.get).toHaveBeenCalledWith(
        `${mockConductorUrl}/api/services/key_manager/api/keys/test-key`,
        expect.any(Object)
      );
    });

    it('should call key_manager API when MOCK_KEY_MANAGER is false', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      const mockKey = {
        key_material: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        key_version: 1,
        algorithm: 'AES-256-GCM'
      };
      axios.get.mockResolvedValue({ data: mockKey });

      const key = await encryptionService.getEncryptionKey('test-key', projectId);

      expect(key).toEqual(mockKey);
      expect(axios.get).toHaveBeenCalledWith(
        `${mockConductorUrl}/api/services/key_manager/api/keys/test-key?project_id=${encodeURIComponent(projectId)}`,
        expect.any(Object)
      );
    });

    it('should throw error if key_manager returns 404', async () => {
      process.env.MOCK_KEY_MANAGER = 'false';
      axios.get.mockRejectedValue({ response: { status: 404 } });

      await expect(
        encryptionService.getEncryptionKey('nonexistent-key', projectId)
      ).rejects.toThrow('not found');
    });
  });

  describe('encryptBuffer', () => {
    it('should encrypt buffer', async () => {
      const data = Buffer.from('test data');
      const encrypted = await encryptionService.encryptBuffer(data, 'test-key', projectId);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(data.length);
    });

    it('should produce different encrypted data for same input', async () => {
      const data = Buffer.from('test data');
      const encrypted1 = await encryptionService.encryptBuffer(data, 'test-key', projectId);
      const encrypted2 = await encryptionService.encryptBuffer(data, 'test-key', projectId);

      expect(encrypted1).not.toEqual(encrypted2);
    });
  });

  describe('decryptBuffer', () => {
    it('should decrypt encrypted buffer', async () => {
      const originalData = Buffer.from('test data');
      const encrypted = await encryptionService.encryptBuffer(originalData, 'test-key', projectId);
      const decrypted = await encryptionService.decryptBuffer(encrypted, 'test-key', projectId);

      expect(decrypted).toEqual(originalData);
    });

    it('should throw error for invalid encrypted data', async () => {
      const invalidData = Buffer.from('invalid encrypted data');

      await expect(
        encryptionService.decryptBuffer(invalidData, 'test-key', projectId)
      ).rejects.toThrow();
    });
  });

  describe('encryptStream', () => {
    it('should return a transform when using mock keys', async () => {
      const { Readable } = require('stream');
      const input = Readable.from([Buffer.from('hello')]);
      const transform = await encryptionService.encryptStream(input, 'test-key', projectId);
      expect(transform).toBeDefined();
      expect(typeof transform.pipe).toBe('function');
    });
  });

  describe('generateETag', () => {
    it('should generate consistent ETag for same data', () => {
      const data = Buffer.from('test data');
      const etag1 = encryptionService.generateETag(data);
      const etag2 = encryptionService.generateETag(data);

      expect(etag1).toBe(etag2);
      expect(etag1).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate different ETag for different data', () => {
      const data1 = Buffer.from('test data 1');
      const data2 = Buffer.from('test data 2');
      const etag1 = encryptionService.generateETag(data1);
      const etag2 = encryptionService.generateETag(data2);

      expect(etag1).not.toBe(etag2);
    });
  });
});
