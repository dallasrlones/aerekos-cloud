const request = require('supertest');
const app = require('../../index.js');
describe('mcp_manager', () => {
  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  test('GET /api/v1/platform-tools lists backup/iac/systems schemas', async () => {
    const res = await request(app).get('/api/v1/platform-tools');
    expect(res.status).toBe(200);
    const names = (res.body.items || []).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([
      'backup.run', 'iac.hookup', 'edge.hookup', 'systems.check', 'graphql.execute', 'search.query',
    ]));
    expect(res.body.note).toMatch(/outbound send disabled/);
  });
});
