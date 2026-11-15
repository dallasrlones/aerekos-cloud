const request = require('supertest');
const express = require('express');
const DatabaseService = require('../../api/services/DatabaseService');
const EncryptionService = require('../../api/services/EncryptionService');

const API_PID = '44444444-4444-4444-8444-444444444444';
const Q = `project_id=${API_PID}`;

jest.mock('../../api/services/DatabaseService');
jest.mock('../../api/services/EncryptionService');
jest.mock('../../api/middleware/auth', () => (req, res, next) => {
  req.service = { name: 'test-service' };
  next();
});

describe('Database API Endpoints', () => {
  let app;
  let mockDatabaseService;

  beforeEach(() => {
    process.env.MOCK_KEY_MANAGER = 'true';
    process.env.SERVICE_TOKEN = 'test-token';

    mockDatabaseService = {
      createDatabase: jest.fn(),
      getDatabase: jest.fn(),
      listDatabases: jest.fn(),
      deleteDatabase: jest.fn(),
      getConnectionString: jest.fn(),
      updateStatus: jest.fn()
    };

    DatabaseService.mockImplementation(() => mockDatabaseService);
    EncryptionService.mockImplementation(() => ({
      ensureEncryptionKey: jest.fn()
    }));

    delete require.cache[require.resolve('../../api/routes/databases')];
    const databaseRoutes = require('../../api/routes/databases');
    databaseRoutes.initializeDatabaseService('http://localhost:3000', 'test-token');

    app = express();
    app.use(express.json());
    app.use('/api/databases', databaseRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/databases', () => {
    it('should create a database', async () => {
      const mockDb = {
        id: 'db-123',
        name: 'test-db',
        type: 'postgresql',
        status: 'creating'
      };

      mockDatabaseService.createDatabase.mockResolvedValue(mockDb);

      const response = await request(app)
        .post(`/api/databases?${Q}`)
        .send({
          name: 'test-db',
          type: 'postgresql',
          worker_id: 'worker-123'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('test-db');
      expect(mockDatabaseService.createDatabase).toHaveBeenCalledWith(
        'test-db',
        'postgresql',
        API_PID,
        expect.objectContaining({ worker_id: 'worker-123' })
      );
    });

    it('should return 400 if name is missing', async () => {
      await request(app)
        .post(`/api/databases?${Q}`)
        .send({ type: 'postgresql' })
        .expect(400);
    });

    it('should return 400 if type is missing', async () => {
      await request(app)
        .post(`/api/databases?${Q}`)
        .send({ name: 'test-db' })
        .expect(400);
    });

    it('should return 409 if database already exists', async () => {
      mockDatabaseService.createDatabase.mockRejectedValue(
        new Error("Database 'test-db' already exists in project x")
      );

      await request(app)
        .post(`/api/databases?${Q}`)
        .send({
          name: 'test-db',
          type: 'postgresql'
        })
        .expect(409);
    });
  });

  describe('GET /api/databases', () => {
    it('should list all databases', async () => {
      const mockDbs = [
        { id: 'db-1', name: 'db1', type: 'postgresql' },
        { id: 'db-2', name: 'db2', type: 'mongodb' }
      ];

      mockDatabaseService.listDatabases.mockResolvedValue(mockDbs);

      const response = await request(app)
        .get(`/api/databases?${Q}`)
        .expect(200);

      expect(response.body.databases).toHaveLength(2);
    });

    it('should filter databases by type', async () => {
      const mockDbs = [{ id: 'db-1', name: 'db1', type: 'postgresql' }];
      mockDatabaseService.listDatabases.mockResolvedValue(mockDbs);

      const response = await request(app)
        .get(`/api/databases?${Q}&type=postgresql`)
        .expect(200);

      expect(mockDatabaseService.listDatabases).toHaveBeenCalledWith(
        API_PID,
        expect.objectContaining({ type: 'postgresql' })
      );
      expect(response.body.databases).toEqual([
        expect.objectContaining({
          id: 'db-1',
          name: 'db1',
          type: 'postgresql',
          project_id: API_PID,
          arn: `arn:aerekos:${API_PID}:db:database/db1`,
          invoke_scope: expect.objectContaining({ connect: 'db:Connect' }),
        }),
      ]);
    });
  });

  describe('GET /api/databases/:name', () => {
    it('should get database details', async () => {
      const mockDb = {
        id: 'db-123',
        name: 'test-db',
        type: 'postgresql',
        status: 'running'
      };

      mockDatabaseService.getDatabase.mockResolvedValue(mockDb);

      const response = await request(app)
        .get(`/api/databases/test-db?${Q}`)
        .expect(200);

      expect(response.body.name).toBe('test-db');
    });

    it('should return 404 if database not found', async () => {
      mockDatabaseService.getDatabase.mockRejectedValue(
        new Error("Database 'nonexistent' not found in project x")
      );

      await request(app)
        .get(`/api/databases/nonexistent?${Q}`)
        .expect(404);
    });
  });

  describe('GET /api/databases/:name/connection', () => {
    it('should return connection details built from the live instance', async () => {
      mockDatabaseService.getDatabase.mockResolvedValue({
        name: 'test-db',
        type: 'postgresql',
        username: 'u',
        port: 5432
      });
      mockDatabaseService.getPassword = jest.fn().mockResolvedValue('secret');
      mockDatabaseService.getHostIp = () => '10.0.0.1';
      mockDatabaseService.buildConnectionString = jest
        .fn()
        .mockReturnValue('postgresql://user:pass@host:5432/db');

      const response = await request(app)
        .get(`/api/databases/test-db/connection?${Q}`)
        .expect(200);

      expect(response.body.connection_string).toBe('postgresql://user:pass@host:5432/db');
    });
  });

  describe('DELETE /api/databases/:name', () => {
    it('should delete database', async () => {
      mockDatabaseService.deleteDatabase.mockResolvedValue();

      await request(app)
        .delete(`/api/databases/test-db?${Q}`)
        .expect(204);

      expect(mockDatabaseService.deleteDatabase).toHaveBeenCalledWith('test-db', API_PID);
    });

    it('should return 404 if database not found', async () => {
      mockDatabaseService.deleteDatabase.mockRejectedValue(
        new Error("Database 'nonexistent' not found in project x")
      );

      await request(app)
        .delete(`/api/databases/nonexistent?${Q}`)
        .expect(404);
    });
  });
});
