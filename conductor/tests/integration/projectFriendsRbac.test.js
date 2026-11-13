'use strict';

const request = require('supertest');
const app = require('../../index');
const { ProjectMember, ProjectInvite, Project } = require('../../api/models');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject } = require('../helpers/dbHelper');

describe('Friends RBAC + E43 list scope', () => {
  let adminToken;
  let owner;
  let ownerToken;
  let viewer;
  let viewerToken;
  let stranger;
  let strangerToken;
  let project;

  beforeAll(async () => {
    await setupTestDatabase();
    const admin = await createTestUser({ role: 'admin', username: `rbac-admin-${Date.now()}` });
    owner = await createTestUser({ role: 'user', username: `rbac-owner-${Date.now()}` });
    viewer = await createTestUser({ role: 'user', username: `rbac-viewer-${Date.now()}` });
    stranger = await createTestUser({ role: 'user', username: `rbac-str-${Date.now()}` });
    adminToken = (await request(app).post('/api/auth/login').send({ username: admin.username, password: 'testpass123' })).body.token;
    ownerToken = (await request(app).post('/api/auth/login').send({ username: owner.username, password: 'testpass123' })).body.token;
    viewerToken = (await request(app).post('/api/auth/login').send({ username: viewer.username, password: 'testpass123' })).body.token;
    strangerToken = (await request(app).post('/api/auth/login').send({ username: stranger.username, password: 'testpass123' })).body.token;

    project = await createTestProject({ created_by: owner.id });
    await ProjectMember.create({ project_id: project.id, user_id: owner.id, role: 'owner' });
    await ProjectMember.create({ project_id: project.id, user_id: viewer.id, role: 'viewer' });
  });

  afterAll(async () => {
    try {
      for (const row of await ProjectInvite.findAll({ where: { project_id: project.id } })) {
        await ProjectInvite.delete(row.id);
      }
      for (const row of await ProjectMember.findAll({ where: { project_id: project.id } })) {
        await ProjectMember.delete(row.id);
      }
      await Project.delete(project.id);
    } catch (_) { /* ignore */ }
    await cleanupTestData();
  });

  test('viewer GET ok / mutating POST 403', async () => {
    const getOk = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(getOk.status).toBe(200);

    const postDenied = await request(app)
      .post(`/api/projects/${project.id}/environments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'viewer-blocked' });
    expect(postDenied.status).toBe(403);
    expect(postDenied.body.error?.code).toBe('PROJECT_ROLE_REQUIRED');
  });

  test('outsider cannot bootstrap foreign open project', async () => {
    const foreign = await createTestProject({
      name: `foreign-open-${Date.now()}`,
      created_by: owner.id,
    });
    const invite = await request(app)
      .post(`/api/projects/${foreign.id}/invites`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ role: 'member' });
    expect(invite.status).toBe(403);

    const asStranger = await request(app)
      .get(`/api/projects/${foreign.id}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(asStranger.status).toBe(403);

    await Project.delete(foreign.id);
  });

  test('list projects scoped for non-admin', async () => {
    const hidden = await createTestProject({
      name: `hidden-${Date.now()}`,
      created_by: owner.id,
    });
    await ProjectMember.create({ project_id: hidden.id, user_id: owner.id, role: 'owner' });

    const listed = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(listed.status).toBe(200);
    const ids = (listed.body.projects || []).map((p) => p.id);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(project.id);

    const ownerList = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`);
    const ownerIds = (ownerList.body.projects || []).map((p) => p.id);
    expect(ownerIds).toContain(project.id);
    expect(ownerIds).toContain(hidden.id);

    const adminList = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminIds = (adminList.body.projects || []).map((p) => p.id);
    expect(adminIds).toContain(hidden.id);

    for (const row of await ProjectMember.findAll({ where: { project_id: hidden.id } })) {
      await ProjectMember.delete(row.id);
    }
    await Project.delete(hidden.id);
  });

  test('invite email optional + maturity ga', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'viewer', email: 'friend@example.com' });
    expect(created.status).toBe(201);
    expect(created.body.maturity).toBe('ga');
    expect(created.body.invite?.email).toBe('friend@example.com');
  });
});
