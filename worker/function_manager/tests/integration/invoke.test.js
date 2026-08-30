const request = require('supertest');
const app = require('../../index.js');

describe('function_manager invoke', () => {
  const pid = 'p-fn-' + Date.now();
  test('sync echo with SKIP_INVOKE', async () => {
    process.env.SKIP_INVOKE = '1';
    process.env.SKIP_QUEUE_PROVISION = '1';
    const c = await request(app).post('/api/v1/functions').send({
      project_id: pid,
      name: 'hello',
      trigger: { queue: false },
    });
    expect(c.status).toBe(201);
    const inv = await request(app).post('/api/v1/functions/hello/invoke').send({
      project_id: pid,
      payload: { ping: 1 },
      invocation_type: 'RequestResponse',
    });
    expect(inv.status).toBe(200);
    expect(inv.body.result.echo.ping).toBe(1);
  });
});
