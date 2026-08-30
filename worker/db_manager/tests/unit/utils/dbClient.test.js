const db = require('../../../api/utils/dbClient');

describe('dbClient', () => {
  it('should connect to SQLite database', () => {
    expect(db).toBeDefined();
    // aerekos-record exposes model factory + healthCheck (not a generic .query on the top-level)
    expect(typeof db.model).toBe('function');
  });

  it('should have healthCheck method', async () => {
    expect(db.healthCheck).toBeDefined();
    const health = await db.healthCheck();
    expect(health).toHaveProperty('healthy');
  });

  it('should return healthy status when database is accessible', async () => {
    const health = await db.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
