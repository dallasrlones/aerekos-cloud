const KeyRepository = require('../../api/repos/KeyRepository');
const { Key, KeyAccess } = require('../../api/models');

jest.mock('../../api/models');

describe('KeyRepository', () => {
  let repository;
  
  beforeEach(() => {
    repository = new KeyRepository();
  });
  
  describe('create', () => {
    test('should create a key', async () => {
      const keyData = { name: 'test-key', type: 'symmetric' };
      const createdKey = { id: 'test-id', ...keyData };
      
      Key.create.mockResolvedValue(createdKey);
      
      const result = await repository.create(keyData);
      
      expect(result).toEqual(createdKey);
      expect(Key.create).toHaveBeenCalledWith(keyData);
    });
  });
  
  describe('findByName', () => {
    test('should find key by name', async () => {
      const key = { id: 'test-id', name: 'test-key', key_version: 1 };
      Key.findAll.mockResolvedValue([key]);
      
      const result = await repository.findByName('test-key');
      
      expect(result).toEqual(key);
      expect(Key.findAll).toHaveBeenCalledWith({
        where: { name: 'test-key' },
        order: 'key_version DESC'
      });
    });
    
    test('should return null if key not found', async () => {
      Key.findAll.mockResolvedValue([]);
      
      const result = await repository.findByName('nonexistent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('findByNameAndVersion', () => {
    test('should find key by name and version', async () => {
      const key = { id: 'test-id', name: 'test-key', key_version: 2 };
      Key.findAll.mockResolvedValue([key]);
      
      const result = await repository.findByNameAndVersion('test-key', 2);
      
      expect(result).toEqual(key);
      expect(Key.findAll).toHaveBeenCalledWith({
        where: { name: 'test-key', key_version: 2 }
      });
    });
  });
  
  describe('logAccess', () => {
    test('should log key access', async () => {
      const accessData = {
        service_name: 'storage_manager',
        action: 'get',
        ip_address: '127.0.0.1',
        success: true
      };
      const loggedAccess = { id: 'log-id', ...accessData };
      
      KeyAccess.create.mockResolvedValue(loggedAccess);
      
      const result = await repository.logAccess('key-id', accessData);
      
      expect(result).toEqual(loggedAccess);
      expect(KeyAccess.create).toHaveBeenCalled();
    });
  });
});
