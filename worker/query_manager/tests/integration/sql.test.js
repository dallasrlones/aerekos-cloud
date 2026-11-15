'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('query_manager POST /sql', () => {
  const pid = 'p-query_manager-sql-' + Date.now();

  test('runs SELECT against per-project sqlite', async () => {
    const res = await request(app)
      .post('/api/v1/sql')
      .send({ project_id: pid, sql: 'SELECT 1 AS n' });
    expect(res.status).toBe(200);
    expect(res.body.engine).toBe('sqlite');
    expect(res.body.skipped).toBeUndefined();
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows[0]).toMatchObject({ n: 1 });
  });

  test('rejects ATTACH', async () => {
    const res = await request(app)
      .post('/api/v1/sql')
      .send({ project_id: pid, sql: 'ATTACH DATABASE :memory: AS other' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('SKIP_DUCKDB short-circuit returns skipped (non-prod only)', async () => {
    const prev = process.env.SKIP_DUCKDB;
    process.env.SKIP_DUCKDB = '1';
    try {
      const res = await request(app)
        .post('/api/v1/sql')
        .send({ project_id: pid, sql: 'SELECT 1' });
      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe(true);
      expect(res.body.engine).toBe('sqlite');
    } finally {
      if (prev === undefined) delete process.env.SKIP_DUCKDB;
      else process.env.SKIP_DUCKDB = prev;
    }
  });
});
