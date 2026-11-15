const request = require('supertest');
const express = require('express');
const VectorService = require('../../api/services/VectorService');
const MemorySqlService = require('../../api/services/MemorySqlService');

const API_PID = '44444444-4444-4444-8444-444444444444';
const Q = `project_id=${API_PID}`;

jest.mock('../../api/services/DatabaseService');
jest.mock('../../api/services/EncryptionService');
jest.mock('../../api/middleware/auth', () => (req, res, next) => {
  req.service = { name: 'test-service' };
  req.auth = { typ: 'service', sub: 'test-service' };
  next();
});
jest.mock('../../../shared/authManagerClient', () => ({
  requireAuth: () => (req, res, next) => {
    req.service = { name: 'test-service' };
    req.auth = { typ: 'service', sub: 'test-service' };
    next();
  },
}));

describe('Vector and Memory SQL API', () => {
  let app;
  let mockVectorService;
  let mockMemorySqlService;

  beforeEach(() => {
    process.env.MOCK_KEY_MANAGER = 'true';
    process.env.SERVICE_TOKEN = 'test-token';

    mockVectorService = {
      upsert: jest.fn().mockResolvedValue({ upserted: 1, table: 'memory_vectors' }),
      search: jest.fn().mockResolvedValue({ results: [{ id: 'vec-1', text: 'hello' }], table: 'memory_vectors' }),
      deleteVectors: jest.fn().mockResolvedValue({ deleted: true, table: 'memory_vectors', where: "id IN ('vec-1')" })
    };
    mockMemorySqlService = {
      run: jest.fn().mockResolvedValue({ rows: [{ content: 'hello' }], rowCount: 1 }),
      ensureSchema: jest.fn().mockResolvedValue({ schema: 'memory_v1' })
    };

    jest.spyOn(VectorService.prototype, 'upsert').mockImplementation(mockVectorService.upsert);
    jest.spyOn(VectorService.prototype, 'search').mockImplementation(mockVectorService.search);
    jest.spyOn(VectorService.prototype, 'deleteVectors').mockImplementation(mockVectorService.deleteVectors);
    jest.spyOn(MemorySqlService.prototype, 'run').mockImplementation(mockMemorySqlService.run);
    jest.spyOn(MemorySqlService.prototype, 'ensureSchema').mockImplementation(mockMemorySqlService.ensureSchema);

    delete require.cache[require.resolve('../../api/routes/databases')];
    const databaseRoutes = require('../../api/routes/databases');
    databaseRoutes.initializeDatabaseService('http://localhost:3000', 'test-token');

    app = express();
    app.use(express.json());
    app.use('/api/databases', databaseRoutes);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POST /vectors/upsert validates and forwards', async () => {
    const response = await request(app)
      .post(`/api/databases/mem-vectors/vectors/upsert?${Q}`)
      .send({
        rows: [{ id: 'vec-1', vector: Array.from({ length: 384 }, () => 0.1) }]
      })
      .expect(200);

    expect(response.body.upserted).toBe(1);
    expect(mockVectorService.upsert).toHaveBeenCalled();
  });

  it('POST /vectors/search returns results', async () => {
    const response = await request(app)
      .post(`/api/databases/mem-vectors/vectors/search?${Q}`)
      .send({ vector: Array.from({ length: 384 }, () => 0.1), top_k: 3 })
      .expect(200);

    expect(response.body.results[0].id).toBe('vec-1');
  });

  it('DELETE /vectors requires ids or filter', async () => {
    await request(app)
      .delete(`/api/databases/mem-vectors/vectors?${Q}`)
      .send({})
      .expect(400);

    await request(app)
      .delete(`/api/databases/mem-vectors/vectors?${Q}`)
      .send({ ids: ['vec-1'] })
      .expect(200);
  });

  it('POST /memory/sql proxies sqlite operations', async () => {
    const response = await request(app)
      .post(`/api/databases/mem-meta/memory/sql?${Q}`)
      .send({
        op: 'query',
        sql: 'SELECT content FROM st_messages WHERE message_id = ?',
        params: ['msg-1']
      })
      .expect(200);

    expect(response.body.rows[0].content).toBe('hello');
  });
});
