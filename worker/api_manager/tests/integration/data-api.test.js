const request = require('supertest');
const app = require('../../index.js');

const USER_POST = {
  name: 'app',
  engine: 'sqlite3',
  database: 'app-db',
  desired: 1,
  autoscaling: { min: 1, max: 4, metric: 'rps', target: 50 },
  models: {
    User: {
      fields: { name: 'string', email: 'string', owner_id: 'string' },
      settings: { required: ['email'], unique: ['email'], hasMany: ['Post'], timestamps: true },
    },
    Post: {
      fields: { title: 'string', body: 'string' },
      settings: { belongsTo: ['User'], timestamps: true },
    },
  },
};

describe('api_manager Data API', () => {
  const pid = 'p-data-' + Date.now();

  test('apply User model, create, unique email', async () => {
    const apply = await request(app).post('/api/v1/data-apis/apply').send({
      project_id: pid,
      name: 'app',
      models: {
        User: {
          fields: { name: 'string', email: 'string', owner_id: 'string' },
          settings: { required: ['email'], unique: ['email'], timestamps: true },
        },
      },
    });
    expect(apply.status).toBe(200);
    expect(apply.body.compiled[0].indexes).toEqual(expect.arrayContaining(['created_at', 'updated_at', 'owner_id']));
    const c1 = await request(app).post('/api/v1/data/app/User').send({ project_id: pid, name: 'a', email: `a-${pid}@b.test` });
    expect(c1.status).toBe(201);
    const list = await request(app).get('/api/v1/data/app/User').query({ project_id: pid });
    expect(list.body.items.length).toBe(1);
    const dup = await request(app).post('/api/v1/data/app/User').send({ project_id: pid, name: 'b', email: `a-${pid}@b.test` });
    expect(dup.status).toBe(409);
  });

  test('User/Post relationships, nested routes, include, where', async () => {
    const pid2 = 'p-rel-' + Date.now();
    const apply = await request(app).post('/api/v1/data-apis/apply').send({ project_id: pid2, ...USER_POST });
    expect(apply.status).toBe(200);
    const userCompiled = apply.body.compiled.find((c) => c.model === 'User');
    const postCompiled = apply.body.compiled.find((c) => c.model === 'Post');
    expect(userCompiled.hasMany).toEqual(expect.arrayContaining(['Post']));
    expect(postCompiled.belongsTo).toEqual(expect.arrayContaining(['User']));
    expect(postCompiled.indexes).toEqual(expect.arrayContaining(['user_id']));
    expect(apply.body.endpoints.some((e) => e.action === 'list_nested')).toBe(true);
    expect(apply.body.database.query_engine).toBe('sqlite');

    const user = await request(app).post('/api/v1/data/app/User').send({
      project_id: pid2, name: 'ada', email: `ada-${pid2}@example.com`,
    });
    expect(user.status).toBe(201);
    const uid = user.body.item.id;

    const post = await request(app).post(`/api/v1/data/app/User/${uid}/posts`).send({
      project_id: pid2, title: 'hello', body: 'world',
    });
    expect(post.status).toBe(201);
    expect(post.body.item.user_id).toBe(uid);

    const nested = await request(app).get(`/api/v1/data/app/User/${uid}/posts`).query({ project_id: pid2 });
    expect(nested.status).toBe(200);
    expect(nested.body.items.length).toBe(1);

    const included = await request(app).get('/api/v1/data/app/User').query({ project_id: pid2, include: 'posts' });
    expect(included.status).toBe(200);
    expect(included.body.items[0].posts.length).toBe(1);

    const where = await request(app).get('/api/v1/data/app/User').query({
      project_id: pid2,
      where: JSON.stringify({ email: `ada-${pid2}@example.com` }),
    });
    expect(where.body.items.length).toBe(1);

    const scaled = await request(app).post('/api/v1/data-apis/app/scale').send({ project_id: pid2, desired: 2 });
    expect(scaled.status).toBe(200);
    expect(scaled.body.item.desired).toBe(2);

    const evaluated = await request(app).post('/api/v1/data-apis/app/autoscaling/evaluate').send({
      project_id: pid2, rps: 999,
    });
    expect(evaluated.status).toBe(200);
    expect(evaluated.body.desired).toBeGreaterThanOrEqual(2);
  });
});
