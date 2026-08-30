const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId, zoneId) =>
  `project_id=${encodeURIComponent(projectId)}&zone_id=${encodeURIComponent(zoneId)}`;

describe('domain_manager DNS API', () => {
  const projectId = 'proj-test-dns';
  const zoneId = 'zone-mock-123';

  test('POST /api/v1/dns/records creates record', async () => {
    const res = await request(app)
      .post('/api/v1/dns/records')
      .send({
        project_id: projectId,
        zone_id: zoneId,
        name: 'app.example.com',
        record_type: 'A',
        content: '192.0.2.1',
        ttl: 300,
        proxied: true
      });
    expect(res.status).toBe(201);
    expect(res.body.record).toMatchObject({
      project_id: projectId,
      zone_id: zoneId,
      name: 'app.example.com',
      type: 'A',
      content: '192.0.2.1',
      proxied: true
    });
    expect(res.body.record.id).toBeDefined();
    expect(res.body.record.cf_record_id).toMatch(/^cf-mock-/);
  });

  test('GET /api/v1/dns/records lists by project and zone', async () => {
    const res = await request(app).get(`/api/v1/dns/records?${Q(projectId, zoneId)}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.records)).toBe(true);
    expect(res.body.records.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/dns/records/:id returns one', async () => {
    const list = await request(app).get(`/api/v1/dns/records?${Q(projectId, zoneId)}`);
    const id = list.body.records[0].id;
    const res = await request(app).get(
      `/api/v1/dns/records/${id}?${Q(projectId, zoneId)}`
    );
    expect(res.status).toBe(200);
    expect(res.body.record.id).toBe(id);
  });

  test('PATCH /api/v1/dns/records/:id updates content', async () => {
    const list = await request(app).get(`/api/v1/dns/records?${Q(projectId, zoneId)}`);
    const id = list.body.records[0].id;
    const res = await request(app)
      .patch(`/api/v1/dns/records/${id}?${Q(projectId, zoneId)}`)
      .send({ content: '192.0.2.2' });
    expect(res.status).toBe(200);
    expect(res.body.record.content).toBe('192.0.2.2');
  });

  test('DELETE /api/v1/dns/records/:id removes row', async () => {
    const create = await request(app)
      .post('/api/v1/dns/records')
      .send({
        project_id: projectId,
        zone_id: zoneId,
        name: 'rm.example.com',
        record_type: 'A',
        content: '192.0.2.3'
      });
    const id = create.body.record.id;
    const del = await request(app).delete(
      `/api/v1/dns/records/${id}?${Q(projectId, zoneId)}`
    );
    expect(del.status).toBe(200);
    const get = await request(app).get(
      `/api/v1/dns/records/${id}?${Q(projectId, zoneId)}`
    );
    expect(get.status).toBe(404);
  });
});
