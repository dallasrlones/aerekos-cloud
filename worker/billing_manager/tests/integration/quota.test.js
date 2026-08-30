const request = require('supertest');
const app = require('../../index.js');

describe('billing_manager evaluate-quota', () => {
  const pid = 'p-billing-quota-' + Date.now();

  test('denies when value is over limit and never returns unlimited', async () => {
    const c = await request(app).post('/api/v1/meters').send({
      project_id: pid,
      name: 'compute_seconds',
      unit: 'seconds',
      value: '11',
      limit: '10',
    });
    expect(c.status).toBe(201);

    const r = await request(app).post('/api/v1/evaluate-quota').send({
      project_id: pid,
      meter: 'compute_seconds',
    });
    expect(r.status).toBe(200);
    expect(r.body.allowed).toBe(false);
    expect(r.body.value).toBe(11);
    expect(r.body.limit).toBe(10);
    expect(r.body.remaining).toBe(0);
    expect(r.body.unlimited).toBeUndefined();
  });

  test('allows under quota without unlimited stub', async () => {
    const c = await request(app).post('/api/v1/meters').send({
      project_id: pid,
      name: 'api_calls',
      unit: 'count',
      value: '3',
      limit: '10',
    });
    expect(c.status).toBe(201);
    const r = await request(app).post('/api/v1/evaluate-quota').send({
      project_id: pid,
      meter: 'api_calls',
    });
    expect(r.status).toBe(200);
    expect(r.body.allowed).toBe(true);
    expect(r.body.remaining).toBe(7);
    expect(r.body.unlimited).toBeUndefined();
  });
});
