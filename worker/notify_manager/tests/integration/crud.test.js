'use strict';

const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('notify_manager crud', () => {
  const pid = 'p-notify_manager-crud-' + Date.now();

  test('messages create get update delete', async () => {
    const c = await request(app)
      .post('/api/v1/messages')
      .send({
        project_id: pid,
        name: 'n1',
        channel: 'email',
        to_address: 'a@b.example',
        subject: 'hi',
        body: 'hello',
        status: 'queued',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/messages?' + Q(pid));
    expect(list.status).toBe(200);
    expect(list.body.items.some((it) => it.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/messages/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);

    const u = await request(app)
      .patch('/api/v1/messages/' + id + '?' + Q(pid))
      .send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/messages/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('channels create get delete', async () => {
    const c = await request(app)
      .post('/api/v1/channels')
      .send({ project_id: pid, name: 'ch1', channel: 'slack', config: '{}', status: 'active' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/channels/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    const d = await request(app).delete('/api/v1/channels/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('send under NOTIFY_USE_MOCK stays queue-only / mock', async () => {
    const c = await request(app)
      .post('/api/v1/messages')
      .send({
        project_id: pid,
        name: 'send-mock',
        channel: 'email',
        to_address: 'a@b.example',
        subject: 'hello',
        body: 'world',
        status: 'queued',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const send = await request(app)
      .post('/api/v1/messages/' + id + '/send?' + Q(pid))
      .send({});
    expect(send.status).toBe(200);
    expect(send.body.skipped).toBe(true);
    expect(send.body.mock).toBe(true);
    expect(send.body.item.status).toBe('queued');
  });

  test('POST /api/v1/test mock send', async () => {
    const res = await request(app)
      .post('/api/v1/test')
      .send({
        project_id: pid,
        channel: 'sms',
        payload: { to: '+15555550100', body: 'ping' },
        useMock: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.result.mock).toBe(true);
    expect(res.body.result.sendResult.mock).toBe(true);
  });

  test('create message without project_id returns 400', async () => {
    const res = await request(app).post('/api/v1/messages').send({ name: 'no-pid' });
    expect(res.status).toBe(400);
  });
});
