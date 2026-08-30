const fs = require('fs');
const os = require('os');
const path = require('path');
const LanceDBHandler = require('../../../api/services/databases/lancedb');
const VectorService = require('../../../api/services/VectorService');

const VECTOR_DIM = 8;
const makeVector = (seed) => Array.from({ length: VECTOR_DIM }, (_, i) => (seed + i) * 0.01);

describe('VectorService', () => {
  let tmpDir;
  let dbPath;
  let mockDatabaseService;
  let vectorService;
  const projectId = 'proj-1';
  const dbName = 'test-vectors';

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lancedb-test-'));
    const handler = new LanceDBHandler();
    const fileInfo = await handler.createInstance({
      name: dbName,
      projectName: 'testproj',
      basePath: tmpDir
    });
    dbPath = fileInfo.database;

    mockDatabaseService = {
      getDatabase: jest.fn().mockResolvedValue({
        type: 'lancedb',
        metadata: JSON.stringify({
          database: dbPath,
          defaultTable: 'memory_vectors'
        })
      })
    };
    vectorService = new VectorService(mockDatabaseService);
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('upserts and searches vectors', async () => {
    const upsert = await vectorService.upsert(dbName, projectId, {
      rows: [
        {
          id: 'vec-1',
          vector: makeVector(1),
          text: 'user likes morning workouts',
          user_id: 'user-a',
          session_id: 'sess-1',
          metadata: { topic: 'fitness' }
        },
        {
          id: 'vec-2',
          vector: makeVector(50),
          text: 'prefers typescript over javascript',
          user_id: 'user-a',
          session_id: 'sess-2'
        }
      ],
      vector_dim: VECTOR_DIM
    });
    expect(upsert.upserted).toBe(2);

    const search = await vectorService.search(dbName, projectId, {
      vector: makeVector(1),
      top_k: 2,
      vector_dim: VECTOR_DIM
    });
    expect(search.results.length).toBeGreaterThan(0);
    expect(search.results[0].id).toBe('vec-1');
    expect(search.results[0].text).toContain('morning workouts');
  });

  it('filters search by user_id', async () => {
    await vectorService.upsert(dbName, projectId, {
      rows: [{
        id: 'vec-user-b',
        vector: makeVector(1),
        text: 'secret for user b',
        user_id: 'user-b',
        session_id: 'sess-b'
      }],
      vector_dim: VECTOR_DIM
    });

    const search = await vectorService.search(dbName, projectId, {
      vector: makeVector(1),
      top_k: 5,
      filter: { user_id: 'user-b' },
      vector_dim: VECTOR_DIM
    });
    expect(search.results.every((r) => r.user_id === 'user-b')).toBe(true);
  });

  it('deletes vectors by id', async () => {
    await vectorService.deleteVectors(dbName, projectId, { ids: ['vec-2'] });
    const search = await vectorService.search(dbName, projectId, {
      vector: makeVector(50),
      top_k: 5,
      vector_dim: VECTOR_DIM
    });
    expect(search.results.find((r) => r.id === 'vec-2')).toBeUndefined();
  });

  it('rejects wrong vector dimension', async () => {
    await expect(vectorService.upsert(dbName, projectId, {
      rows: [{ id: 'bad', vector: [1, 2, 3] }],
      vector_dim: VECTOR_DIM
    })).rejects.toThrow(/does not match expected/);
  });
});
