const request = require('supertest');
const express = require('express');
const DatabaseService = require('../../api/services/DatabaseService');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

jest.mock('../../api/services/DatabaseService');
jest.mock('../../api/services/BackupService', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../../shared/authManagerClient', () => ({
  requireAuth: () => (req, res, next) => {
    req.auth = { typ: 'service', sub: 'test' };
    next();
  },
}));

describe('db_manager databases ARN', () => {
  let app;
  let mockDatabaseService;

  beforeEach(() => {
    mockDatabaseService = {
      createDatabase: jest.fn(),
      listDatabases: jest.fn(),
      getDatabase: jest.fn(),
    };
    DatabaseService.mockImplementation(() => mockDatabaseService);

    delete require.cache[require.resolve('../../api/routes/databases')];
    const databaseRoutes = require('../../api/routes/databases');
    databaseRoutes.initializeDatabaseService('http://localhost:3000', 'test-token');

    app = express();
    app.use(express.json());
    app.use('/api/databases', databaseRoutes);
  });

  test('create and list responses include arn + invoke_scope', async () => {
    const name = 'analytics';
    const row = { id: 'db-1', name, type: 'redis', project_id: PID, status: 'creating' };
    mockDatabaseService.createDatabase.mockResolvedValue(row);
    mockDatabaseService.listDatabases.mockResolvedValue([row]);

    const created = await request(app)
      .post('/api/databases')
      .query({ project_id: PID })
      .send({ name, type: 'redis' });

    expect(created.status).toBe(201);
    expect(created.body.arn).toBe(`arn:aerekos:${PID}:db:database/${name}`);
    expect(created.body.invoke_scope.connect).toBe('db:Connect');

    const listed = await request(app).get('/api/databases').query({ project_id: PID });
    expect(listed.status).toBe(200);
    expect(listed.body.databases[0].arn).toBe(`arn:aerekos:${PID}:db:database/${name}`);
  });
});
