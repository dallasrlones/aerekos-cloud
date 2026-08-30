const request = require('supertest');
const app = require('../../index.js');
const { hub } = require('../../api/hub');

describe('websocket_manager publish', () => {
  const pid = 'p-ws-pub-' + Date.now();
  test('HTTP publish returns delivered count', async () => {
    await request(app).post('/api/v1/channels').send({ project_id: pid, name: 'app' });
    const fake = { readyState: 1, sent: [], send(m) { this.sent.push(m); }, on() {} };
    hub.subscribe(pid, 'app', fake);
    const r = await request(app).post('/api/v1/publish').send({ project_id: pid, channel: 'app', payload: { ping: 1 } });
    expect(r.status).toBe(200);
    expect(r.body.delivered).toBe(1);
    expect(JSON.parse(fake.sent[0]).payload.ping).toBe(1);
  });
});
