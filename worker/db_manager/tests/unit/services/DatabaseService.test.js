const PID = '11111111-1111-1111-1111-111111111111';

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: { project: { name: 'tproj' } } })
}));

jest.mock('../../../api/services/InstanceService', () =>
  jest.fn().mockImplementation(() => ({
    findAvailablePort: jest.fn().mockResolvedValue(15432),
    createInstance: jest.fn().mockResolvedValue({
      name: 'aerekos-c',
      port: 15432,
      host: '10.0.0.1'
    }),
    deleteInstance: jest.fn().mockResolvedValue(undefined),
    startInstance: jest.fn().mockResolvedValue(undefined),
    stopInstance: jest.fn().mockResolvedValue(undefined)
  }))
);

const DatabaseService = require('../../../api/services/DatabaseService');
const DatabaseRepository = require('../../../api/repos/DatabaseRepository');
const EncryptionService = require('../../../api/services/EncryptionService');

jest.mock('../../../api/repos/DatabaseRepository');
jest.mock('../../../api/services/EncryptionService');

describe('DatabaseService', () => {
  let databaseService;
  let mockRepository;
  let mockEncryptionService;
  const mockConductorUrl = 'http://localhost:3000';
  const mockServiceToken = 'test-token';

  beforeEach(() => {
    process.env.MOCK_KEY_MANAGER = 'true';

    mockRepository = {
      create: jest.fn(),
      findByName: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByWorker: jest.fn(),
      findByType: jest.fn(),
      findByStatus: jest.fn()
    };

    mockEncryptionService = {
      encryptData: jest.fn(),
      decryptData: jest.fn(),
      ensureEncryptionKey: jest.fn()
    };

    DatabaseRepository.mockImplementation(() => mockRepository);
    EncryptionService.mockImplementation(() => mockEncryptionService);

    databaseService = new DatabaseService(mockConductorUrl, mockServiceToken);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDatabase', () => {
    it('should create database with encrypted connection string and password', async () => {
      const mockDbInstance = {
        id: 'db-123',
        name: 'test-db',
        type: 'postgresql',
        status: 'creating',
        project_id: PID
      };

      mockRepository.findByName.mockResolvedValue(null);
      mockEncryptionService.encryptData
        .mockResolvedValueOnce('encrypted-connection-string')
        .mockResolvedValueOnce('encrypted-password');
      mockRepository.create.mockResolvedValue(mockDbInstance);
      mockRepository.update.mockImplementation(async (id, u) => ({ id, ...mockDbInstance, ...u }));

      const result = await databaseService.createDatabase('test-db', 'postgresql', PID, {
        worker_id: 'worker-123'
      });

      expect(mockEncryptionService.encryptData).toHaveBeenCalledTimes(2);
      expect(mockEncryptionService.encryptData).toHaveBeenCalledWith(
        expect.stringContaining('postgresql://'),
        'db-manager-encryption-key',
        PID
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-db',
          type: 'postgresql',
          project_id: PID,
          connection_string: 'encrypted-connection-string',
          password_encrypted: 'encrypted-password'
        })
      );
      expect(result).toEqual(expect.objectContaining({ status: 'running' }));
    });

    it('should throw error if database already exists', async () => {
      mockRepository.findByName.mockResolvedValue({ id: 'existing-id', name: 'test-db' });

      await expect(
        databaseService.createDatabase('test-db', 'postgresql', PID)
      ).rejects.toThrow('already exists');
    });
  });

  describe('getDatabase', () => {
    it('should return database instance', async () => {
      const mockDbInstance = {
        id: 'db-123',
        name: 'test-db',
        type: 'postgresql',
        connection_string: 'encrypted-connection-string',
        project_id: PID
      };

      mockRepository.findByName.mockResolvedValue(mockDbInstance);

      const result = await databaseService.getDatabase('test-db', PID);

      expect(result).toEqual(mockDbInstance);
      expect(mockRepository.findByName).toHaveBeenCalledWith('test-db', PID);
    });

    it('should throw error if database not found', async () => {
      mockRepository.findByName.mockResolvedValue(null);

      await expect(
        databaseService.getDatabase('nonexistent-db', PID)
      ).rejects.toThrow('not found');
    });
  });

  describe('getConnectionString', () => {
    it('should decrypt and return connection string', async () => {
      const mockDbInstance = {
        id: 'db-123',
        name: 'test-db',
        connection_string: 'encrypted-connection-string',
        type: 'postgresql',
        project_id: PID
      };

      mockRepository.findByName.mockResolvedValue(mockDbInstance);
      mockEncryptionService.decryptData.mockResolvedValue('postgresql://user:pass@host:5432/db');

      const connectionString = await databaseService.getConnectionString('test-db', PID);

      expect(mockEncryptionService.decryptData).toHaveBeenCalledWith(
        'encrypted-connection-string',
        'db-manager-encryption-key',
        PID
      );
      expect(connectionString).toBe('postgresql://user:pass@host:5432/db');
    });
  });

  describe('listDatabases', () => {
    it('should return list of databases', async () => {
      const mockDatabases = [
        { id: 'db-1', name: 'db1', type: 'postgresql', project_id: PID },
        { id: 'db-2', name: 'db2', type: 'mongodb', project_id: PID }
      ];

      mockRepository.findAll.mockResolvedValue(mockDatabases);

      const result = await databaseService.listDatabases(PID);

      expect(result).toEqual(mockDatabases);
      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: PID })
      );
    });

    it('should filter databases by type', async () => {
      const mockDatabases = [
        { id: 'db-1', name: 'db1', type: 'postgresql', project_id: PID }
      ];

      mockRepository.findAll.mockResolvedValue(mockDatabases);

      const result = await databaseService.listDatabases(PID, { type: 'postgresql' });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: PID, type: 'postgresql' })
      );
      expect(result).toEqual(mockDatabases);
    });
  });

  describe('deleteDatabase', () => {
    it('should delete database instance', async () => {
      const mockDbInstance = {
        id: 'db-123',
        name: 'test-db',
        metadata: JSON.stringify({ storage: { type: 'volume' } })
      };

      mockRepository.findByName.mockResolvedValue(mockDbInstance);
      mockRepository.delete.mockResolvedValue();

      await databaseService.deleteDatabase('test-db', PID);

      expect(mockRepository.delete).toHaveBeenCalledWith('db-123');
    });

    it('should throw error if database not found', async () => {
      mockRepository.findByName.mockResolvedValue(null);

      await expect(
        databaseService.deleteDatabase('nonexistent-db', PID)
      ).rejects.toThrow('not found');
    });
  });
});
