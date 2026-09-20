const request = require('supertest');
const app = require('../../index.js');

const PID = 'a1111111-1111-1111-1111-111111111111';
const USER = 'user-e2e-1';
const SESSION = 'sess-e2e-1';

process.env.MEMORY_DB_FALLBACK = '1';

describe('ai_manager memory e2e (fallback stores)', () => {
  beforeAll(async () => {
    await request(app)
      .put('/api/v1/memory/config')
      .query({ project_id: PID })
      .send({
        store_name_prefix: 'e2e',
        data_worker_id: 'worker-local',
        embeddings_integration: '',
        extractor_integration: '',
        window_size: 200,
        importance_threshold: 0.5,
      })
      .expect(200);

    await request(app)
      .post('/api/v1/memory/setup')
      .query({ project_id: PID })
      .expect(200);
  });

  test('ingest + search recalls embedded fact', async () => {
    const ingest = await request(app)
      .post('/api/v1/memory/ingest')
      .query({ project_id: PID })
      .send({
        user_id: USER,
        session_id: SESSION,
        message_id: 'msg-remember-workout',
        role: 'user',
        content: 'Remember I prefer morning workouts at 6am every day',
        seq: 1,
      });
    expect(ingest.status).toBe(200);
    expect(ingest.body.ingested).toBe(true);
    expect(ingest.body.embedded).toBe(true);

    const dup = await request(app)
      .post('/api/v1/memory/ingest')
      .query({ project_id: PID })
      .send({
        user_id: USER,
        session_id: SESSION,
        message_id: 'msg-remember-workout',
        role: 'user',
        content: 'duplicate',
        seq: 2,
      });
    expect(dup.body.duplicate).toBe(true);

    const search = await request(app)
      .post('/api/v1/memory/search')
      .query({ project_id: PID })
      .send({
        user_id: USER,
        session_id: SESSION,
        short_term: true,
        query_text: 'workout schedule',
        top_k: 5,
      });
    expect(search.status).toBe(200);
    expect(search.body.context).toMatch(/morning workouts/i);
  });

  test('GET /info lists memory capability', async () => {
    const info = await request(app).get('/api/v1/info');
    expect(info.body.capabilities).toContain('memory');
  });

  test('promote moves important chunks to long-term', async () => {
    await request(app)
      .post('/api/v1/memory/ingest')
      .query({ project_id: PID })
      .send({
        user_id: USER,
        session_id: SESSION,
        message_id: 'msg-promote-1',
        role: 'user',
        content: 'Remember I always prefer morning workouts at 6am',
        seq: 10,
      })
      .expect(200);

    const promote = await request(app)
      .post('/api/v1/memory/promote')
      .query({ project_id: PID })
      .send({ user_id: USER, session_id: SESSION });
    expect(promote.status).toBe(200);
    expect(promote.body.promoted).toBeGreaterThanOrEqual(1);

    const search = await request(app)
      .post('/api/v1/memory/search')
      .query({ project_id: PID })
      .send({
        user_id: USER,
        session_id: SESSION,
        short_term: false,
        long_term: true,
        query_text: 'workout time',
        top_k: 5,
      });
    expect(search.status).toBe(200);
    expect(search.body.context).toMatch(/morning workouts/i);
  });

  test('GET /stores/:id returns the named store', async () => {
    const created = await request(app)
      .post('/api/v1/memory/stores')
      .query({ project_id: PID })
      .send({ name: 'console-store', window_size: 50 });
    expect(created.status).toBe(201);
    const id = created.body.config.id;
    expect(id).toBeTruthy();
    const got = await request(app)
      .get(`/api/v1/memory/stores/${id}`)
      .query({ project_id: PID });
    expect(got.status).toBe(200);
    expect(got.body.item.name).toBe('console-store');
    expect(got.body.item.id).toBe(id);
  });

  test('DELETE session clears short-term data', async () => {
    const del = await request(app)
      .delete(`/api/v1/memory/sessions/${SESSION}`)
      .query({ project_id: PID });
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);
  });
});
