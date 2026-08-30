const KeyService = require('../../api/services/KeyService');
const KeyRepository = require('../../api/repos/KeyRepository');

jest.mock('../../api/repos/KeyRepository');

describe('Key Lifecycle Integration Tests', () => {
  let keyService;
  let mockRepository;
  const masterKey = 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
  
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
  
  test('should complete full key lifecycle: create → get → rotate → archive → delete', async () => {
    // 1. Create key
    const createdKey = {
      id: 'key-1',
      name: 'lifecycle-key',
      type: 'symmetric',
      algorithm: 'AES-256-GCM',
      encrypted_key: 'encrypted-key-1',
      key_version: 1,
      is_active: 1,
      metadata: '{}',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockRepository.findByName.mockResolvedValue(null);
    mockRepository.create.mockResolvedValue(createdKey);
    
    const created = await keyService.createKey('lifecycle-key', 'symmetric', 'AES-256-GCM');
    expect(created).toHaveProperty('name', 'lifecycle-key');
    expect(created).toHaveProperty('key_version', 1);
    
    // 2. Get key
    const encrypted = keyService.encryptKey('test-key-material');
    createdKey.encrypted_key = encrypted;
    mockRepository.findByName.mockResolvedValue(createdKey);
    
    const retrieved = await keyService.getKey('lifecycle-key');
    expect(retrieved).toHaveProperty('name', 'lifecycle-key');
    expect(retrieved).toHaveProperty('key_material');
    
    // 3. Rotate key
    const rotatedKey = {
      id: 'key-2',
      name: 'lifecycle-key',
      type: 'symmetric',
      algorithm: 'AES-256-GCM',
      encrypted_key: 'encrypted-key-2',
      key_version: 2,
      is_active: 1,
      metadata: '{}',
      rotated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockRepository.findByName.mockResolvedValue(createdKey);
    mockRepository.update.mockResolvedValue(createdKey);
    mockRepository.create.mockResolvedValue(rotatedKey);
    
    const rotated = await keyService.rotateKey('lifecycle-key');
    expect(rotated).toHaveProperty('key_version', 2);
    expect(mockRepository.update).toHaveBeenCalledWith('key-1', { is_active: 0 });
    
    // 4. Archive key
    // archiveKey() calls findByName twice: once to find current, once after update
    // to format the response. We need both to resolve in order.
    const archivedKey = { ...rotatedKey, is_active: 0 };
    mockRepository.findByName
      .mockReset()
      .mockResolvedValueOnce(rotatedKey)
      .mockResolvedValueOnce(archivedKey);
    mockRepository.update.mockResolvedValue(archivedKey);

    const archived = await keyService.archiveKey('lifecycle-key');
    expect(archived).toHaveProperty('is_active', false);
    
    // 5. Delete key
    mockRepository.findAll.mockResolvedValue([rotatedKey]);
    mockRepository.delete.mockResolvedValue();
    
    await keyService.deleteKey('lifecycle-key');
    expect(mockRepository.delete).toHaveBeenCalled();
  });
  
  test('should handle key versioning correctly', async () => {
    // Pre-encrypt real values so getKey() can decrypt them in the test path.
    const encryptedV1 = keyService.encryptKey('material-v1');
    const encryptedV2 = keyService.encryptKey('material-v2');

    const version1 = {
      id: 'v1',
      name: 'versioned-key',
      key_version: 1,
      is_active: 1,
      encrypted_key: encryptedV1,
      type: 'symmetric',
      algorithm: 'AES-256-GCM',
      metadata: '{}',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const version2 = {
      id: 'v2',
      name: 'versioned-key',
      key_version: 2,
      is_active: 1,
      encrypted_key: encryptedV2,
      type: 'symmetric',
      algorithm: 'AES-256-GCM',
      metadata: '{}',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Get version 1
    mockRepository.findByNameAndVersion.mockResolvedValueOnce(version1);
    const v1 = await keyService.getKey('versioned-key', 1);
    expect(v1).toHaveProperty('key_version', 1);
    
    // Get version 2
    mockRepository.findByNameAndVersion.mockResolvedValueOnce(version2);
    const v2 = await keyService.getKey('versioned-key', 2);
    expect(v2).toHaveProperty('key_version', 2);
    
    // Get latest (should be version 2)
    mockRepository.findByName.mockResolvedValue(version2);
    const latest = await keyService.getKey('versioned-key');
    expect(latest).toHaveProperty('key_version', 2);
  });
});
