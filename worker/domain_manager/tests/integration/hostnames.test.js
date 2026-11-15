'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('domain_manager hostnames / zones', () => {
  const projectId = 'proj-test-hostnames';

  test('GET /api/v1/dns/zones returns mock zones under SKIP_CLOUDFLARE', async () => {
    const res = await request(app).get('/api/v1/dns/zones');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.zones)).toBe(true);
    expect(res.body.zones.length).toBeGreaterThan(0);
    expect(res.body.zones[0]).toHaveProperty('id');
    expect(res.body.zones[0]).toHaveProperty('name');
  });

  test('POST/GET/PATCH/DELETE /api/v1/dns/hostnames CRUD', async () => {
    const create = await request(app)
      .post('/api/v1/dns/hostnames')
      .send({
        project_id: projectId,
        hostname: 'app.closeout.example.com',
        target_type: 'compute_task',
        target_id: 'task-1',
        tunnel_id: 'tun-mock',
        skip_dns: true,
      });
    expect(create.status).toBe(201);
    expect(create.body.hostname).toMatchObject({
      project_id: projectId,
      hostname: 'app.closeout.example.com',
      target_type: 'compute_task',
    });
    const id = create.body.hostname.id;

    const list = await request(app).get(
      `/api/v1/dns/hostnames?project_id=${encodeURIComponent(projectId)}`
    );
    expect(list.status).toBe(200);
    expect(list.body.hostnames.some((h) => h.id === id)).toBe(true);

    const patch = await request(app)
      .patch(`/api/v1/dns/hostnames/${id}?project_id=${encodeURIComponent(projectId)}`)
      .send({ port: 8080 });
    expect(patch.status).toBe(200);
    expect(patch.body.hostname.port).toBe(8080);

    const del = await request(app).delete(
      `/api/v1/dns/hostnames/${id}?project_id=${encodeURIComponent(projectId)}`
    );
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);
  });
});
