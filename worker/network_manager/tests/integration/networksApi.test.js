const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('network_manager /networks', () => {
  const projectId = `proj-net-${Date.now()}`;

  test('POST list get delete (SKIP_DOCKER)', async () => {
    const post = await request(app)
      .post('/api/v1/networks')
      .send({ project_id: projectId, name: 'front_net' });
    expect(post.status).toBe(201);
    const id = post.body.network.id;
    expect(post.body.network.docker_network_name).toMatch(/^mock-aerekosn_/);
    expect(post.body.network.driver).toBe('bridge');

    const dup = await request(app)
      .post('/api/v1/networks')
      .send({ project_id: projectId, name: 'front_net' });
    expect(dup.status).toBe(409);

    const list = await request(app).get(`/api/v1/networks?${Q(projectId)}`);
    expect(list.status).toBe(200);
    expect(list.body.networks).toHaveLength(1);
    expect(list.body.networks[0].id).toBe(id);

    const one = await request(app).get(`/api/v1/networks/${id}?${Q(projectId)}`);
    expect(one.status).toBe(200);
    expect(one.body.network.name).toBe('front_net');

    const del = await request(app).delete(`/api/v1/networks/${id}?${Q(projectId)}`);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    const after = await request(app).get(`/api/v1/networks?${Q(projectId)}`);
    expect(after.body.networks).toHaveLength(0);
  });

  test('list without project_id returns 400', async () => {
    const r = await request(app).get('/api/v1/networks');
    expect(r.status).toBe(400);
  });
});
