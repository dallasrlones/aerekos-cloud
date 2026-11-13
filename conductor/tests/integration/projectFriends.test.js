const request = require('supertest');
const app = require('../../index');
const { ProjectMember, ProjectInvite } = require('../../api/models');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject } = require('../helpers/dbHelper');

describe('Project friends invites', () => {
  let adminToken;
  let ownerToken;
  let friendToken;
  let outsiderToken;
  let owner;
  let friend;
  let project;

  beforeAll(async () => {
    await setupTestDatabase();
    const admin = await createTestUser({ role: 'admin', username: `fr-admin-${Date.now()}` });
    owner = await createTestUser({ role: 'user', username: `fr-owner-${Date.now()}` });
    friend = await createTestUser({ role: 'user', username: `fr-friend-${Date.now()}` });
    const outsider = await createTestUser({ role: 'user', username: `fr-out-${Date.now()}` });
    adminToken = (await request(app).post('/api/auth/login').send({ username: admin.username, password: 'testpass123' })).body.token;
    ownerToken = (await request(app).post('/api/auth/login').send({ username: owner.username, password: 'testpass123' })).body.token;
    friendToken = (await request(app).post('/api/auth/login').send({ username: friend.username, password: 'testpass123' })).body.token;
    outsiderToken = (await request(app).post('/api/auth/login').send({ username: outsider.username, password: 'testpass123' })).body.token;
    project = await createTestProject();
  });

  afterAll(async () => {
    try {
      for (const row of await ProjectInvite.findAll({ where: { project_id: project.id } })) {
        await ProjectInvite.delete(row.id);
      }
      for (const row of await ProjectMember.findAll({ where: { project_id: project.id } })) {
        await ProjectMember.delete(row.id);
      }
    } catch (_) { /* ignore */ }
    await cleanupTestData();
  });

  test('owner creates invite; friend accepts; outsider 403', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
    expect(created.status).toBe(201);
    expect(created.body.invite?.token).toBeTruthy();
    expect(created.body.maturity).toBe('ga');

    const membersAfterInvite = await request(app)
      .get(`/api/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(membersAfterInvite.status).toBe(200);
    expect((membersAfterInvite.body.members || []).some((m) => m.user_id === owner.id && m.role === 'owner')).toBe(true);

    const accepted = await request(app)
      .post('/api/projects/invites/accept')
      .set('Authorization', `Bearer ${friendToken}`)
      .send({ token: created.body.invite.token });
    expect(accepted.status).toBe(200);
    expect(accepted.body.member?.user_id).toBe(friend.id);
    expect(accepted.body.member?.status).toBe('active');

    const asFriend = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${friendToken}`);
    expect(asFriend.status).toBe(200);

    const asOutsider = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(asOutsider.status).toBe(403);

    const asAdmin = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(asAdmin.status).toBe(200);
  });

  test('revoke member removes access', async () => {
    const revoked = await request(app)
      .delete(`/api/projects/${project.id}/members/${friend.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revoked.status).toBe(200);
    expect(revoked.body.status).toBe('revoked');

    const asFriend = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${friendToken}`);
    expect(asFriend.status).toBe(403);
  });
});
