const request = require('supertest');
const app = require('../../index');
const { ProjectMember } = require('../../api/models');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject } = require('../helpers/dbHelper');

describe('Project membership', () => {
  let adminToken;
  let memberToken;
  let outsiderToken;
  let member;
  let project;

  beforeAll(async () => {
    await setupTestDatabase();
    const admin = await createTestUser({ role: 'admin', username: `mem-admin-${Date.now()}` });
    member = await createTestUser({ role: 'user', username: `mem-in-${Date.now()}` });
    const outsider = await createTestUser({ role: 'user', username: `mem-out-${Date.now()}` });
    adminToken = (await request(app).post('/api/auth/login').send({ username: admin.username, password: 'testpass123' })).body.token;
    memberToken = (await request(app).post('/api/auth/login').send({ username: member.username, password: 'testpass123' })).body.token;
    outsiderToken = (await request(app).post('/api/auth/login').send({ username: outsider.username, password: 'testpass123' })).body.token;
    project = await createTestProject();
  });

  afterAll(async () => {
    try {
      const rows = await ProjectMember.findAll({ where: { project_id: project.id } });
      for (const row of rows) await ProjectMember.delete(row.id);
    } catch (_) { /* ignore */ }
    await cleanupTestData();
  });

  test('empty members stay open for any authenticated user', async () => {
    const res = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(200);
  });

  test('GET/POST /:id/members as admin', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: member.id, role: 'member' });
    expect(created.status).toBe(201);
    expect(created.body.member.user_id).toBe(member.id);

    const listed = await request(app)
      .get(`/api/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect((listed.body.members || []).some((m) => m.user_id === member.id)).toBe(true);
  });

  test('non-member 403 after first member exists', async () => {
    const res = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('PROJECT_MEMBER_REQUIRED');
  });

  test('listed member can read; admin still bypasses', async () => {
    const asMember = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(asMember.status).toBe(200);
    const asAdmin = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(asAdmin.status).toBe(200);
  });
});
