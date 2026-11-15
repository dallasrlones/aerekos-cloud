const request = require('supertest');
const app = require('../../index.js');

describe('mcp_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('mcp_manager');
  });

  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.service).toBe('mcp_manager');
  });

  test('GET /api/v1/platform-tools lists backup/iac/systems schemas', async () => {
    const res = await request(app).get('/api/v1/platform-tools');
    expect(res.status).toBe(200);
    const names = (res.body.items || []).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([
      'backup.run', 'iac.hookup', 'iac.apply', 'edge.hookup', 'systems.check', 'graphql.execute', 'search.query',
    ]));
    expect(res.body.note).toMatch(/outbound send disabled/);
  });
});
