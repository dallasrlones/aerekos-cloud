const fs = require('fs');
const os = require('os');
const path = require('path');
const Record = require('aerekos-record');
const MemorySqlService = require('../../../api/services/MemorySqlService');

describe('MemorySqlService', () => {
  let tmpDir;
  let dbPath;
  let mockDatabaseService;
  let memorySqlService;
  const projectId = 'proj-1';
  const dbName = 'test-memory-meta';

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-sql-test-'));
    dbPath = path.join(tmpDir, 'memory.db');
    const db = Record.connect('sqlite', { database: dbPath });
    await db.close();

    mockDatabaseService = {
      getDatabase: jest.fn().mockResolvedValue({
        type: 'sqlite3',
        metadata: JSON.stringify({ database: dbPath })
      })
    };
    memorySqlService = new MemorySqlService(mockDatabaseService);
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('ensures memory schema via aerekos-record models', async () => {
    const result = await memorySqlService.ensureSchema(dbName, projectId);
    expect(result.schema).toBe('memory_v1');

    const db = Record.connect('sqlite', { database: dbPath });
    const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    await db.close();
    expect(tables).toEqual(expect.arrayContaining(['st_messages', 'memory_sessions', 'lt_facts']));
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
