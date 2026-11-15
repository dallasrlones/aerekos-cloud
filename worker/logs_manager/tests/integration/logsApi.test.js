const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('logs_manager API', () => {
  const projectId = `proj-logs-${Date.now()}`;

  test('POST and GET /logs', async () => {
    const c = await request(app)
      .post('/api/v1/logs')
      .send({
        project_id: projectId,
        source: 'test.unit',
        level: 'info',
        message: 'hello',
        context: { trace: '1' }
      });
    expect(c.status).toBe(201);
    expect(c.body.log.message).toBe('hello');
    expect(c.body.log.context).toEqual({ trace: '1' });

    const g = await request(app).get(`/api/v1/logs?${Q(projectId)}`);
    expect(g.status).toBe(200);
    expect(g.body.logs.length).toBeGreaterThan(0);
    expect(g.body.logs[0].message).toBe('hello');
  });

  test('GET /logs with level filter', async () => {
    await request(app)
      .post('/api/v1/logs')
      .send({ project_id: projectId, level: 'error', message: 'oops' });
    const g = await request(app).get(
      `/api/v1/logs?${Q(projectId)}&level=error`
    );
    expect(g.status).toBe(200);
    const errs = g.body.logs.filter((l) => l.level === 'error');
    expect(errs.length).toBeGreaterThan(0);
  });

  test('GET /logs/:id', async () => {
    const c = await request(app)
      .post('/api/v1/logs')
      .send({ project_id: projectId, level: 'debug', message: 'byid' });
    const id = c.body.log.id;
    const g = await request(app).get(`/api/v1/logs/${id}?${Q(projectId)}`);
    expect(g.status).toBe(200);
    expect(g.body.log.id).toBe(id);
  });

  test('GET /logs filters source and q', async () => {
    const pid = `proj-search-${Date.now()}`;
    await request(app).post('/api/v1/logs').send({
      project_id: pid, source: 'compute.abc', level: 'info', message: 'hello nginx started',
    });
    await request(app).post('/api/v1/logs').send({
      project_id: pid, source: 'other', level: 'info', message: 'unrelated',
    });
    const bySource = await request(app).get(`/api/v1/logs?${Q(pid)}&source=compute.abc`);
    expect(bySource.status).toBe(200);
    expect(bySource.body.logs.every((l) => l.source === 'compute.abc')).toBe(true);
    const byQ = await request(app).get(`/api/v1/logs?${Q(pid)}&q=nginx`);
    expect(byQ.status).toBe(200);
    expect(byQ.body.logs.some((l) => /nginx/i.test(l.message))).toBe(true);
    expect(byQ.body.logs.every((l) => /nginx/i.test(l.message))).toBe(true);
    const byUntil = await request(app).get(`/api/v1/logs?${Q(pid)}&until=2000-01-01T00:00:00.000Z`);
    expect(byUntil.status).toBe(200);
    expect(byUntil.body.logs.length).toBe(0);
  });

  test('POST /logs/batch', async () => {
    const pid = `proj-batch-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/logs/batch')
      .send({
        project_id: pid,
        entries: [
          { level: 'info', source: 'batch', message: 'a', context: { n: 1 } },
          { level: 'warn', message: 'b' }
        ]
      });
    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
    expect(res.body.logs[0].message).toBe('a');
    expect(res.body.logs[1].message).toBe('b');
  });

  test('POST /logs rejects missing fields', async () => {
    const bad = await request(app).post('/api/v1/logs').send({ level: 'info', message: 'x' });
    expect(bad.status).toBe(400);
    const badLevel = await request(app)
      .post('/api/v1/logs')
      .send({ project_id: projectId, level: 'nope', message: 'x' });
    expect(badLevel.status).toBe(400);
  });

  test('DELETE /logs/:id and POST /logs/compact', async () => {
    const pid = `proj-del-${Date.now()}`;
    const c = await request(app)
      .post('/api/v1/logs')
      .send({ project_id: pid, level: 'info', message: 'to-delete' });
    expect(c.status).toBe(201);
    const id = c.body.log.id;
    const d = await request(app).delete(`/api/v1/logs/${id}?${Q(pid)}`);
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
    const miss = await request(app).get(`/api/v1/logs/${id}?${Q(pid)}`);
    expect(miss.status).toBe(404);

    await request(app).post('/api/v1/logs').send({ project_id: pid, level: 'info', message: 'keep' });
    const compact = await request(app)
      .post('/api/v1/logs/compact')
      .send({ project_id: pid, older_than_days: 9999 });
    expect(compact.status).toBe(200);
    expect(compact.body).toHaveProperty('compacted');
    expect(compact.body).toHaveProperty('older_than');
  });
});
