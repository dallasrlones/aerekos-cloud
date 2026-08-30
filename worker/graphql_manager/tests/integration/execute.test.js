jest.mock('axios');
const axios = require('axios');
const request = require('supertest');
const app = require('../../index.js');

describe('graphql_manager execute', () => {
  const pid = 'p-gql-exec-' + Date.now();

  beforeEach(() => {
    axios.mockReset();
    axios.mockImplementation(async (cfg) => {
      const method = String(cfg.method || 'get').toLowerCase();
      if (method === 'get') {
        return { status: 200, data: { items: [{ id: 'u1', name: 'ada' }] } };
      }
      if (method === 'post') {
        return { status: 201, data: { item: { id: 'u2', name: cfg.data?.name || 'created' } } };
      }
      if (method === 'patch') {
        return { status: 200, data: { item: { id: cfg.url.split('/').pop(), name: cfg.data?.name || 'patched' } } };
      }
      return { status: 200, data: {} };
    });
  });

  test('execute query walks Data API via axios', async () => {
    const compiled = await request(app).post('/api/v1/compile').send({
      project_id: pid,
      name: 'app',
      models: { User: { fields: { name: 'string' } } },
    });
    expect(compiled.status).toBe(200);
    expect(compiled.body.schema).toMatch(/type Mutation/);

    const r = await request(app).post('/api/v1/execute').send({
      project_id: pid,
      name: 'app',
      query: '{ users { id name } }',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.users).toEqual([{ id: 'u1', name: 'ada' }]);
    expect(axios).toHaveBeenCalled();
    const call = axios.mock.calls[0][0];
    expect(call.url).toMatch(/\/api\/services\/api_manager\/api\/v1\/data\/app\/User/);
  });

  test('execute mutation createUser posts to Data API', async () => {
    await request(app).post('/api/v1/compile').send({
      project_id: pid,
      name: 'app',
      models: { User: { fields: { name: 'string' } } },
    });
    const r = await request(app).post('/api/v1/execute').send({
      project_id: pid,
      name: 'app',
      query: 'mutation { createUser(name: "lin") { id name } }',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.createUser.name).toBe('lin');
    const post = axios.mock.calls.find((c) => String(c[0].method).toLowerCase() === 'post');
    expect(post).toBeTruthy();
  });
});
