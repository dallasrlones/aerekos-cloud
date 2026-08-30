const KeyService = require('../../api/services/KeyService');
const KeyRepository = require('../../api/repos/KeyRepository');

jest.mock('../../api/repos/KeyRepository');

describe('KeyService', () => {
  let keyService;
  let mockRepository;
  const masterKey = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678'; // 64 hex chars = 32 bytes (AES-256)
  
  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findByName: jest.fn(),
      findByNameAndVersion: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findActiveVersions: jest.fn(),
      logAccess: jest.fn()
    };
    KeyRepository.mockImplementation(() => mockRepository);
    keyService = new KeyService(mockRepository, masterKey);
  });
  
  describe('createKey', () => {
    test('should create a symmetric key', async () => {
      const keyData = {
        id: 'test-id',
        name: 'test-key',
        type: 'symmetric',
        algorithm: 'AES-256-GCM',
        encrypted_key: 'encrypted',
        key_version: 1,
        is_active: 1,
        metadata: '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(keyData);
      
      const result = await keyService.createKey('test-key', 'symmetric', 'AES-256-GCM');
      
      expect(result).toHaveProperty('name', 'test-key');
      expect(result).toHaveProperty('type', 'symmetric');
      expect(mockRepository.create).toHaveBeenCalled();
    });
    
    test('should throw error if key already exists', async () => {
      mockRepository.findByName.mockResolvedValue({ id: 'existing-id', name: 'test-key' });
      
      await expect(
        keyService.createKey('test-key', 'symmetric', 'AES-256-GCM')
      ).rejects.toThrow('already exists');
    });
    
    test('should throw error if required fields missing', async () => {
      await expect(
        keyService.createKey('', 'symmetric', 'AES-256-GCM')
      ).rejects.toThrow('required');
    });
  });
  
  describe('getKey', () => {
    test('should get key by name', async () => {
      const keyData = {
        id: 'test-id',
        name: 'test-key',
        type: 'symmetric',
        algorithm: 'AES-256-GCM',
        encrypted_key: 'iv:authTag:encrypted',
        key_version: 1,
        is_active: 1,
        metadata: '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      mockRepository.findByName.mockResolvedValue(keyData);
      
      // Mock decryptKey by creating a key first to get encrypted format
      const testKeyMaterial = 'test-key-material';
      const encrypted = keyService.encryptKey(testKeyMaterial);
      keyData.encrypted_key = encrypted;
      
      mockRepository.findByName.mockResolvedValue(keyData);
      
      const result = await keyService.getKey('test-key');
      
      expect(result).toHaveProperty('name', 'test-key');
      expect(result).toHaveProperty('key_material');
    });
    
    test('should throw error if key not found', async () => {
      mockRepository.findByName.mockResolvedValue(null);
      
      await expect(
        keyService.getKey('nonexistent-key')
      ).rejects.toThrow('not found');
    });
  });
  
  describe('rotateKey', () => {
    test('should rotate key and create new version', async () => {
      const oldKey = {
        id: 'old-id',
        name: 'test-key',
        type: 'symmetric',
        algorithm: 'AES-256-GCM',
        encrypted_key: 'encrypted',
        key_version: 1,
        is_active: 1,
        metadata: '{}'
      };
      
      const newKey = {
        id: 'new-id',
        name: 'test-key',
        type: 'symmetric',
        algorithm: 'AES-256-GCM',
        encrypted_key: 'encrypted-new',
        key_version: 2,
        is_active: 1,
        metadata: '{}',
        rotated_at: new Date().toISOString()
      };
      
      mockRepository.findByName.mockResolvedValue(oldKey);
      mockRepository.update.mockResolvedValue(oldKey);
      mockRepository.create.mockResolvedValue(newKey);
      
      const result = await keyService.rotateKey('test-key');
      
      expect(result).toHaveProperty('key_version', 2);
      expect(mockRepository.update).toHaveBeenCalledWith('old-id', { is_active: 0 });
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });
  
  describe('encryptKey and decryptKey', () => {
    test('should encrypt and decrypt key material', () => {
      const keyMaterial = 'test-key-material-12345';
      const encrypted = keyService.encryptKey(keyMaterial);
      const decrypted = keyService.decryptKey(encrypted);
      
      expect(decrypted).toBe(keyMaterial);
      expect(encrypted).toContain(':');
    });
  });
});
