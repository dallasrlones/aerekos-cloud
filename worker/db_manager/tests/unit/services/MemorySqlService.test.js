jest.mock('aerekos-record', () => ({
  connect: jest.fn(),
  registerMemoryModels: jest.fn(),
}));

const Record = require('aerekos-record');
const MemorySqlService = require('../../../api/services/MemorySqlService');

describe('MemorySqlService', () => {
  let mockDatabaseService;
  let memorySqlService;
  let mockStmt;
  let mockDb;
  const projectId = 'proj-1';
  const dbName = 'test-memory-meta';

  beforeEach(() => {
    mockStmt = {
      all: jest.fn().mockReturnValue([{ content: 'hello memory' }]),
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
    };
    mockDb = {
      db: {
        prepare: jest.fn().mockReturnValue(mockStmt)
      }
    };
    Record.connect.mockReturnValue(mockDb);
    Record.registerMemoryModels.mockReturnValue({});

    mockDatabaseService = {
      getDatabase: jest.fn().mockResolvedValue({
        type: 'sqlite3',
        metadata: JSON.stringify({ database: '/tmp/memory.db' })
      })
    };
    memorySqlService = new MemorySqlService(mockDatabaseService);
  });

  it('ensures memory schema via aerekos-record models', async () => {
    const result = await memorySqlService.ensureSchema(dbName, projectId);
    expect(result.schema).toBe('memory_v1');
    expect(Record.registerMemoryModels).toHaveBeenCalledWith(mockDb);
  });

  it('inserts and queries st_messages via memory sql proxy', async () => {
    const insert = await memorySqlService.run(dbName, projectId, {
      op: 'exec',
      sql: `INSERT INTO st_messages (id, message_id, session_id, user_id, role, content, seq, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: ['id-1', 'msg-1', 'sess-1', 'user-1', 'user', 'hello memory', 1, new Date().toISOString()]
    });
    expect(insert.changes).toBe(1);

    const query = await memorySqlService.run(dbName, projectId, {
      op: 'query',
      sql: 'SELECT content FROM st_messages WHERE message_id = ?',
      params: ['msg-1']
    });
    expect(query.rows[0].content).toBe('hello memory');
  });

  it('blocks disallowed tables and destructive SQL', async () => {
    await expect(memorySqlService.run(dbName, projectId, {
      op: 'exec',
      sql: 'DROP TABLE st_messages'
    })).rejects.toThrow(/blocked keywords/);

    await expect(memorySqlService.run(dbName, projectId, {
      op: 'query',
      sql: 'SELECT * FROM users'
    })).rejects.toThrow(/not allowed/);
  });
});
