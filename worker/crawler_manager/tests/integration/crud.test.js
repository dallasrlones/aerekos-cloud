const request = require('supertest');

process.env.SKIP_CRAWL = '1';

const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('crawler_manager crud', () => {
  const pid = 'p-crawler_manager-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/jobs').send({
      project_id: pid,
      name: 'j1',
      start_url: 'https://example.com',
      max_depth: '1',
      result_summary: '',
      state: 'pending',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/jobs/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('j1');

    const u = await request(app).patch('/api/v1/jobs/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/jobs/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('run under SKIP_CRAWL marks done without live fetch', async () => {
    const c = await request(app).post('/api/v1/jobs').send({
      project_id: pid,
      name: 'run-skip',
      start_url: 'https://example.com/page',
      state: 'pending',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const run = await request(app).post('/api/v1/jobs/' + id + '/run?' + Q(pid)).send({});
    expect(run.status).toBe(200);
    expect(run.body.item.state).toBe('done');
    expect(String(run.body.item.result_summary || '')).toMatch(/skipped/);
  });

  test('canary under SKIP_CRAWL returns skipped', async () => {
    const res = await request(app).post('/api/v1/jobs/canary').send({ url: 'https://example.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.skipped).toBe(true);
    expect(res.body.mode).toBe('canary');
  });

  test('create without project_id returns 400', async () => {
    const res = await request(app).post('/api/v1/jobs').send({ name: 'no-pid' });
    expect(res.status).toBe(400);
  });
});
