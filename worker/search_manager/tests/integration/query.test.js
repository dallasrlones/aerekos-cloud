const request = require('supertest');
const app = require('../../index.js');

describe('search_manager FTS query', () => {
  const pid = 'p-search-fts-' + Date.now();

  test('empty hits when index is empty', async () => {
    const r = await request(app).post('/api/v1/query').send({ project_id: pid, index: 'docs', q: 'anything' });
    expect(r.status).toBe(200);
    expect(r.body.hits).toEqual([]);
    expect(r.body.empty).toBe(true);
  });

  test('index then query returns real hits', async () => {
    const idx = await request(app).post('/api/v1/index').send({
      project_id: pid,
      index: 'docs',
      title: 'Hello world',
      body: 'FTS5 indexed document about widgets',
    });
    expect(idx.status).toBe(201);
    expect(idx.body.indexed).toBe(1);

    const miss = await request(app).post('/api/v1/query').send({
      project_id: pid,
      index: 'docs',
      q: 'zzzz-not-present',
    });
    expect(miss.status).toBe(200);
    expect(Array.isArray(miss.body.hits)).toBe(true);

    const hit = await request(app).post('/api/v1/query').send({
      project_id: pid,
      index: 'docs',
      q: 'widgets',
    });
    expect(hit.status).toBe(200);
    expect(hit.body.hits.length).toBeGreaterThan(0);
    expect(hit.body.hits[0].body).toMatch(/widgets/);
    expect(hit.body.hits[0].title).toBe('Hello world');
  });
});
