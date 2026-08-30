const request = require('supertest');
const app = require('../../index.js');

describe('event_manager publish', () => {
  const pid = 'p-evt-' + Date.now();
  test('ensure defaults + put event with SKIP_OUTBOUND rule', async () => {
    process.env.SKIP_OUTBOUND = '1';
    const d = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(d.status).toBe(200);
    const busId = d.body.defaults.default.item.id;
    const rule = await request(app).post('/api/v1/rules').send({
      project_id: pid,
      bus_id: busId,
      name: 'to-email',
      type_pattern: 'ping',
      target_kind: 'email',
      target_ref: 'ops@example.test',
    });
    expect(rule.status).toBe(201);
    const put = await request(app).post('/api/v1/events').send({
      project_id: pid,
      type: 'ping',
      payload: { ok: true },
    });
    expect(put.status).toBe(202);
    expect(put.body.event.type).toBe('ping');
    expect(put.body.deliveries[0].skipped).toBe(true);
  });
});
