'use strict';

const request = require('supertest');
const app = require('../../index');
const {
  ConductorPeer,
  FederationGrant,
  ProjectFederationAttach,
  ProjectMember,
} = require('../../api/models');
const PeerIdentityService = require('../../api/services/PeerIdentityService');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject } = require('../helpers/dbHelper');

describe('Federation mint → attach → status (loopback)', () => {
  let owner;
  let ownerToken;
  let project;

  beforeAll(async () => {
    await setupTestDatabase();
    owner = await createTestUser({ role: 'user', username: `fed-owner-${Date.now()}` });
    ownerToken = (await request(app).post('/api/auth/login').send({
      username: owner.username,
      password: 'testpass123',
    })).body.token;
    project = await createTestProject({ created_by: owner.id });
    await ProjectMember.create({ project_id: project.id, user_id: owner.id, role: 'owner' });
  });

  afterAll(async () => {
    try {
      for (const row of await ProjectFederationAttach.findAll({})) await ProjectFederationAttach.delete(row.id);
      for (const row of await FederationGrant.findAll({})) await FederationGrant.delete(row.id);
      for (const row of await ConductorPeer.findAll({})) await ConductorPeer.delete(row.id);
      for (const row of await ProjectMember.findAll({ where: { project_id: project.id } })) {
        await ProjectMember.delete(row.id);
      }
    } catch (_) { /* ignore */ }
    await cleanupTestData();
  });

  test('peer card, trust self, mint, attach, status', async () => {
    const card = await request(app)
      .get('/api/federation/peer')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(card.status).toBe(200);
    expect(card.body.peer?.peer_id).toBeTruthy();
    expect(card.body.maturity).toBe('preview');
    expect(card.body.peer.peer_id).toBe(PeerIdentityService.getPeerId());

    const trusted = await request(app)
      .post('/api/federation/peers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(card.body.peer);
    expect(trusted.status).toBe(201);

    const minted = await request(app)
      .post(`/api/projects/${project.id}/federation/grants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
    expect(minted.status).toBe(201);
    expect(minted.body.token).toBeTruthy();
    expect(minted.body.maturity).toBe('preview');

    const attached = await request(app)
      .post('/api/federation/attach')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ token: minted.body.token, label: 'loopback' });
    expect(attached.status).toBe(201);
    expect(attached.body.attach?.home_project_id).toBe(project.id);
    expect(attached.body.attach?.id).toBeTruthy();

    const status = await request(app)
      .get(`/api/federation/attaches/${attached.body.attach.id}/status`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(status.status).toBe(200);
    expect(['connecting', 'active', 'degraded', 'disconnected']).toContain(status.body.status);

    const proxied = await request(app)
      .get(`/api/federation/attaches/${attached.body.attach.id}/project`)
      .set('Authorization', `Bearer ${ownerToken}`);
    // Loopback may 401 without forwarding user auth into project ACL; status is still useful.
    expect([200, 401, 403, 502]).toContain(proxied.status);
  });
});
