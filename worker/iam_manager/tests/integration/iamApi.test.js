const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('iam_manager API', () => {
  const suffix = `t${Date.now()}`;
  const projectId = `proj-iam-1-${suffix}`;
  const doc = { actions: ['storage:PutObject'], resources: ['*'] };

  test('creates policy and role, attaches, lists, detaches, deletes', async () => {
    const p = await request(app)
      .post('/api/v1/policies')
      .send({
        project_id: projectId,
        name: `s3.put-${suffix}`,
        effect: 'allow',
        document: doc
      });
    expect(p.status).toBe(201);
    const policyId = p.body.policy.id;
    expect(p.body.policy.document).toEqual(doc);

    const r = await request(app)
      .post('/api/v1/roles')
      .send({ project_id: projectId, name: `dev.writer-${suffix}`, description: 'write access' });
    expect(r.status).toBe(201);
    const roleId = r.body.role.id;

    const at = await request(app)
      .post(`/api/v1/roles/${roleId}/policies`)
      .send({ project_id: projectId, policy_id: policyId });
    expect(at.status).toBe(201);

    const list = await request(app).get(`/api/v1/roles/${roleId}/policies?${Q(projectId)}`);
    expect(list.status).toBe(200);
    expect(list.body.policies).toHaveLength(1);
    expect(list.body.policies[0].id).toBe(policyId);

    const dt = await request(app).delete(
      `/api/v1/roles/${roleId}/policies/${policyId}?${Q(projectId)}`
    );
    expect(dt.status).toBe(200);

    const after = await request(app).get(`/api/v1/roles/${roleId}/policies?${Q(projectId)}`);
    expect(after.body.policies).toHaveLength(0);
  });

  test('POST duplicate role name returns 409', async () => {
    const u = `d${Date.now()}`;
    const projectId2 = `proj-iam-2-${u}`;
    await request(app)
      .post('/api/v1/roles')
      .send({ project_id: projectId2, name: `dup-${u}` });
    const r = await request(app)
      .post('/api/v1/roles')
      .send({ project_id: projectId2, name: `dup-${u}` });
    expect(r.status).toBe(409);
  });
});
