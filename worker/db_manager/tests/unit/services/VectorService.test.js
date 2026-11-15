jest.mock('aerekos-record', () => ({
  connectLance: jest.fn(),
}));

const Record = require('aerekos-record');
const VectorService = require('../../../api/services/VectorService');

const VECTOR_DIM = 8;
const makeVector = (seed) => Array.from({ length: VECTOR_DIM }, (_, i) => (seed + i) * 0.01);

describe('VectorService', () => {
  let mockDatabaseService;
  let mockLance;
  let vectorService;
  const projectId = 'proj-1';
  const dbName = 'test-vectors';

  beforeEach(() => {
    mockLance = {
      upsert: jest.fn().mockResolvedValue({ upserted: 2, table: 'memory_vectors' }),
      search: jest.fn().mockResolvedValue([
        { id: 'vec-1', text: 'user likes morning workouts', user_id: 'user-a' }
      ]),
      deleteVectors: jest.fn().mockResolvedValue({ deleted: true, table: 'memory_vectors', where: "id IN ('vec-1')" })
    };
    Record.connectLance.mockReturnValue(mockLance);

    mockDatabaseService = {
      getDatabase: jest.fn().mockResolvedValue({
        type: 'lancedb',
        metadata: JSON.stringify({
          database: '/tmp/test.lancedb',
          defaultTable: 'memory_vectors'
        })
      })
    };
    vectorService = new VectorService(mockDatabaseService);
  });

  it('upserts and searches vectors', async () => {
    const upsert = await vectorService.upsert(dbName, projectId, {
      rows: [
        { id: 'vec-1', vector: makeVector(1), text: 'user likes morning workouts' },
        { id: 'vec-2', vector: makeVector(50), text: 'prefers typescript' }
      ],
      vector_dim: VECTOR_DIM
    });
    expect(upsert.upserted).toBe(2);
    expect(mockLance.upsert).toHaveBeenCalled();

    const search = await vectorService.search(dbName, projectId, {
      vector: makeVector(1),
      top_k: 2,
      vector_dim: VECTOR_DIM
    });
    expect(search.results[0].id).toBe('vec-1');
    expect(search.results[0].text).toContain('morning workouts');
  });

  it('filters search by user_id', async () => {
    mockLance.search.mockResolvedValueOnce([{ id: 'vec-3', user_id: 'user-b' }]);
    const search = await vectorService.search(dbName, projectId, {
      vector: makeVector(1),
      top_k: 5,
      filter: "user_id = 'user-b'",
      vector_dim: VECTOR_DIM
    });
    expect(mockLance.search).toHaveBeenCalledWith(
      makeVector(1),
      expect.objectContaining({ filter: "user_id = 'user-b'" })
    );
    expect(search.results[0].user_id).toBe('user-b');
  });

  it('deletes vectors by id', async () => {
    const result = await vectorService.deleteVectors(dbName, projectId, { ids: ['vec-1'] });
    expect(result.deleted).toBe(true);
    expect(mockLance.deleteVectors).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ['vec-1'] })
    );
  });

  it('rejects non-lancedb instances', async () => {
    mockDatabaseService.getDatabase.mockResolvedValueOnce({
      type: 'sqlite3',
      metadata: '{}'
    });
    await expect(
      vectorService.upsert(dbName, projectId, { rows: [{ id: 'x', vector: makeVector(1) }] })
    ).rejects.toThrow(/not a lancedb/);
  });
});
