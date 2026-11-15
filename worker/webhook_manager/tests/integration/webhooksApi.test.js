const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('webhook_manager /webhooks', () => {
  const projectId = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

  test('CRUD and dispatch (SKIP_OUTBOUND)', async () => {
    const c = await request(app)
      .post('/api/v1/webhooks')
      .send({
        project_id: projectId,
        name: 'alerts',
        target_url: 'https://httpbin.org/post'
      });
    expect(c.status).toBe(201);
    const id = c.body.webhook.id;

    const dup = await request(app)
      .post('/api/v1/webhooks')
      .send({ project_id: projectId, name: 'alerts', target_url: 'https://a.example/h' });
    expect(dup.status).toBe(409);

    const d = await request(app)
      .post(`/api/v1/webhooks/${id}/dispatch`)
      .send({ project_id: projectId, hello: 'world' });
    expect(d.status).toBe(201);
    expect(d.body.mode).toBe('skip');
    expect(d.body.delivery.status).toBe('skipped');

    const listD = await request(app).get(`/api/v1/webhooks/${id}/deliveries?${Q(projectId)}`);
    expect(listD.body.deliveries).toHaveLength(1);

    const upd = await request(app)
      .patch(`/api/v1/webhooks/${id}?${Q(projectId)}`)
      .send({ name: 'alerts-renamed', enabled: false });
    expect(upd.status).toBe(200);
    expect(upd.body.webhook.name).toBe('alerts-renamed');
    expect(upd.body.webhook.enabled).toBe(false);

    const del = await request(app).delete(`/api/v1/webhooks/${id}?${Q(projectId)}`);
    expect(del.status).toBe(200);
  });
});
