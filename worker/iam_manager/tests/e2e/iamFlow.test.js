'use strict';

/**
 * Local e2e: full role → policy → bind → evaluate → cleanup against the Express app
 * (temp SQLite via tests/setup.js). Live conductor/proxy coverage lives in
 * repo `e2e/tier6-app-access.js` and `e2e/wave2-tunnel-compute-iam.js`.
 */
const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('iam_manager e2e flow', () => {
  const suffix = `e2e${Date.now()}`;
  // project_id for CRUD can be any string; ARNs require a UUID project segment
  const projectId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
  const arn = `arn:aerekos:${projectId}:storage:bucket/uploads`;

  it('completes policy/role/evaluate lifecycle', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);

    const policy = await request(app)
      .post('/api/v1/policies')
      .send({
        project_id: projectId,
        name: `allow-get-${suffix}`,
        effect: 'allow',
        document: { actions: ['storage:GetObject'], resources: [arn] },
        description: 'e2e allow get',
      });
    expect(policy.status).toBe(201);
    const policyId = policy.body.policy.id;

    const role = await request(app)
      .post('/api/v1/roles')
      .send({ project_id: projectId, name: `e2e.reader-${suffix}`, description: 'e2e' });
    expect(role.status).toBe(201);
    const roleId = role.body.role.id;

    const attach = await request(app)
      .post(`/api/v1/roles/${roleId}/policies`)
      .send({ project_id: projectId, policy_id: policyId });
    expect(attach.status).toBe(201);

    const listed = await request(app).get(`/api/v1/roles/${roleId}/policies?${Q(projectId)}`);
    expect(listed.status).toBe(200);
    expect(listed.body.policies.map((p) => p.id)).toContain(policyId);

    const allowed = await request(app)
      .post('/api/v1/evaluate')
      .send({
        project_id: projectId,
        role_id: roleId,
        action: 'storage:GetObject',
        resource_arn: arn,
      });
    expect(allowed.status).toBe(200);
    expect(allowed.body.evaluation.allowed).toBe(true);

    const denied = await request(app)
      .post('/api/v1/evaluate')
      .send({
        project_id: projectId,
        role_id: roleId,
        action: 'storage:DeleteObject',
        resource_arn: arn,
      });
    expect(denied.status).toBe(200);
    expect(denied.body.evaluation.allowed).toBe(false);

    await request(app).delete(`/api/v1/roles/${roleId}/policies/${policyId}?${Q(projectId)}`);
    await request(app).delete(`/api/v1/roles/${roleId}?${Q(projectId)}`);
    await request(app).delete(`/api/v1/policies/${policyId}?${Q(projectId)}`);

    const gone = await request(app).get(`/api/v1/roles/${roleId}?${Q(projectId)}`);
    expect(gone.status).toBe(404);
  });
});
