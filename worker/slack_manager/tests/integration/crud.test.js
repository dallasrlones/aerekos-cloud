const request = require('supertest');

process.env.SKIP_SLACK = '1';

const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('slack_manager crud', () => {
  const pid = 'p-slack_manager-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/messages').send({
      project_id: pid,
      name: 's1',
      channel: '#ops',
      text: 'hi',
      status: 'queued',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/messages/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('s1');

    const u = await request(app).patch('/api/v1/messages/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/messages/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('send under SKIP_SLACK stays queue-only', async () => {
    const c = await request(app).post('/api/v1/messages').send({
      project_id: pid,
      name: 'send-skip',
      channel: '#ops',
      text: 'hello',
      status: 'queued',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const send = await request(app).post('/api/v1/messages/' + id + '/send?' + Q(pid)).send({});
    expect(send.status).toBe(200);
    expect(send.body.skipped).toBe(true);
    expect(send.body.reason).toMatch(/queue_only|queued/);
    expect(send.body.item.status).toBe('queued');
  });

  test('create without project_id returns 400', async () => {
    const res = await request(app).post('/api/v1/messages').send({ name: 'no-pid' });
    expect(res.status).toBe(400);
  });
});
