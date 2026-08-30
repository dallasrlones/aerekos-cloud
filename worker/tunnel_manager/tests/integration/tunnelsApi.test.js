const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('tunnel_manager tunnels API', () => {
  const projectId = 'proj-test-tunnel';

  test('POST /api/v1/tunnels creates and returns one-time token', async () => {
    const res = await request(app)
      .post('/api/v1/tunnels')
      .send({ project_id: projectId, name: 'api-test-1' });
    expect(res.status).toBe(201);
    expect(res.body.tunnel).toMatchObject({
      project_id: projectId,
      name: 'api-test-1',
      status: 'inactive'
    });
    expect(res.body.tunnel.cf_tunnel_id).toMatch(/^cf-tunnel-mock-/);
    expect(res.body.token).toMatch(/^mock-tunnel-token-/);
  });

  test('GET /api/v1/tunnels lists for project', async () => {
    const res = await request(app).get(`/api/v1/tunnels?${Q(projectId)}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tunnels)).toBe(true);
    expect(res.body.tunnels.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/tunnels/:id returns one', async () => {
    const list = await request(app).get(`/api/v1/tunnels?${Q(projectId)}`);
    const id = list.body.tunnels[0].id;
    const res = await request(app).get(`/api/v1/tunnels/${id}?${Q(projectId)}`);
    expect(res.status).toBe(200);
    expect(res.body.tunnel.id).toBe(id);
  });

  test('DELETE /api/v1/tunnels/:id removes row', async () => {
    const create = await request(app)
      .post('/api/v1/tunnels')
      .send({ project_id: projectId, name: 'to-delete' });
    const id = create.body.tunnel.id;
    const del = await request(app).delete(`/api/v1/tunnels/${id}?${Q(projectId)}`);
    expect(del.status).toBe(200);
    const get = await request(app).get(`/api/v1/tunnels/${id}?${Q(projectId)}`);
    expect(get.status).toBe(404);
  });
});
