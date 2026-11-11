const request = require('supertest');
const app = require('../../index.js');

describe('auth_manager user system', () => {
  const pid = 'a1b2c3d4-0000-4000-8000-000000000001';
  const uname = `user_${Date.now()}`.slice(0, 40);

  test('validation: missing project / short username / weak password', async () => {
    expect((await request(app).post('/api/v1/users').send({ username: 'abc', password: 'x1234' })).status).toBe(400);
    expect((await request(app).post('/api/v1/users').send({ project_id: pid, username: 'ab', password: 'x1234' })).status).toBe(400);
    expect((await request(app).post('/api/v1/users').send({ project_id: pid, username: 'abc', password: 'x12' })).status).toBe(400);
  });

  test('create → login → verify → update → disable → delete lifecycle', async () => {
    // create
    const c = await request(app)
      .post('/api/v1/users')
      .send({ project_id: pid, username: uname, password: 'hunter22', name: 'Test User' });
    expect(c.status).toBe(201);
    expect(c.body.user.username).toBe(uname);
    expect(c.body.user.name).toBe('Test User');
    expect(c.body.user.display_color).toMatch(/^#/);
    expect(c.body.user.password_hash).toBeUndefined();
    expect(c.body.user.enabled).toBe(true);
    const uid = c.body.user.id;

    // duplicate username
    const dup = await request(app).post('/api/v1/users').send({ project_id: pid, username: uname, password: 'x12345' });
    expect(dup.status).toBe(409);

    // list
    const l = await request(app).get(`/api/v1/users?project_id=${pid}`);
    expect(l.status).toBe(200);
    expect(l.body.items.some((u) => u.id === uid)).toBe(true);

    // login (password grant)
    const ok = await request(app).post('/api/v1/auth/login').send({ username: uname, password: 'hunter22', project_id: pid });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect(ok.body.user.username).toBe(uname);
    expect(ok.body.expires_in).toBeGreaterThan(0);

    // verify the token through the same authority the conductor uses
    const ver = await request(app).post('/api/v1/auth/verify').send({ token: ok.body.token });
    expect(ver.status).toBe(200);
    expect(ver.body.active).toBe(true);
    expect(ver.body.claims.typ).toBe('user');
    expect(ver.body.claims.sub).toBe(`user:${uid}`);
    expect(ver.body.claims.username).toBe(uname);
    expect(ver.body.claims.project_id).toBe(pid);

    // wrong password
    const bad = await request(app).post('/api/v1/auth/login').send({ username: uname, password: 'wrongpass', project_id: pid });
    expect(bad.status).toBe(401);

    // password update: old fails, new works
    const u = await request(app).patch(`/api/v1/users/${uid}?project_id=${pid}`).send({ password: 'newpass99' });
    expect(u.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ username: uname, password: 'hunter22', project_id: pid })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ username: uname, password: 'newpass99', project_id: pid })).status).toBe(200);

    // disable blocks login
    const d = await request(app).patch(`/api/v1/users/${uid}?project_id=${pid}`).send({ enabled: false });
    expect(d.status).toBe(200);
    expect(d.body.user.enabled).toBe(false);
    expect((await request(app).post('/api/v1/auth/login').send({ username: uname, password: 'newpass99', project_id: pid })).status).toBe(401);

    // get
    const g = await request(app).get(`/api/v1/users/${uid}?project_id=${pid}`);
    expect(g.status).toBe(200);
    expect(g.body.user.enabled).toBe(false);

    // delete → login gone, get 404
    const del = await request(app).delete(`/api/v1/users/${uid}?project_id=${pid}`);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);
    expect((await request(app).post('/api/v1/auth/login').send({ username: uname, password: 'newpass99', project_id: pid })).status).toBe(401);
    expect((await request(app).get(`/api/v1/users/${uid}?project_id=${pid}`)).status).toBe(404);
  });

  test('login with project_id scope: same username in another project does not collide', async () => {
    const other = 'a1b2c3d4-0000-4000-8000-000000000002';
    const a = await request(app).post('/api/v1/users').send({ project_id: pid, username: 'shared', password: 'aaa111' });
    const b = await request(app).post('/api/v1/users').send({ project_id: other, username: 'shared', password: 'bbb222' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const la = await request(app).post('/api/v1/auth/login').send({ username: 'shared', password: 'aaa111', project_id: pid });
    const lb = await request(app).post('/api/v1/auth/login').send({ username: 'shared', password: 'bbb222', project_id: other });
    expect(la.status).toBe(200);
    expect(lb.status).toBe(200);
    expect(la.body.user.id).not.toBe(lb.body.user.id);
  });
});
