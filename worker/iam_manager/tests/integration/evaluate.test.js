const request = require('supertest');
const app = require('../../index.js');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';
const BKT = `arn:aerekos:${PID}:storage:bucket/uploads`;

describe('iam_manager evaluate', () => {
  const suffix = `ev${Date.now()}`;

  test('rejects invalid resource ARN in policy document', async () => {
    const r = await request(app)
      .post('/api/v1/policies')
      .send({
        project_id: `proj-eval-bad-${suffix}`,
        name: `bad-${suffix}`,
        effect: 'allow',
        document: { actions: ['storage:ListBucket'], resources: ['not-an-arn'] },
      });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('INVALID_POLICY_RESOURCES');
  });

  test('evaluate allow and deny via role', async () => {
    const projectId = `proj-eval-${suffix}`;

    const allowPol = await request(app)
      .post('/api/v1/policies')
      .send({
        project_id: projectId,
        name: `allow-read-${suffix}`,
        effect: 'allow',
        document: { actions: ['storage:ListBucket'], resources: [BKT] },
      });
    expect(allowPol.status).toBe(201);

    const denyPol = await request(app)
      .post('/api/v1/policies')
      .send({
        project_id: projectId,
        name: `deny-del-${suffix}`,
        effect: 'deny',
        document: { actions: ['storage:DeleteObject'], resources: [BKT] },
      });
    expect(denyPol.status).toBe(201);

    const role = await request(app)
      .post('/api/v1/roles')
      .send({ project_id: projectId, name: `reader-${suffix}` });
    expect(role.status).toBe(201);
    const roleId = role.body.role.id;

    await request(app)
      .post(`/api/v1/roles/${roleId}/policies`)
      .send({ project_id: projectId, policy_id: allowPol.body.policy.id });
    await request(app)
      .post(`/api/v1/roles/${roleId}/policies`)
      .send({ project_id: projectId, policy_id: denyPol.body.policy.id });

    const allowed = await request(app)
      .post('/api/v1/evaluate')
      .send({
        project_id: projectId,
        role_name: `reader-${suffix}`,
        action: 'storage:ListBucket',
        resource_arn: BKT,
      });
    expect(allowed.status).toBe(200);
    expect(allowed.body.evaluation.allowed).toBe(true);

    const denied = await request(app)
      .post('/api/v1/evaluate')
      .send({
        project_id: projectId,
        role_name: `reader-${suffix}`,
        action: 'storage:DeleteObject',
        resource_arn: BKT,
      });
    expect(denied.status).toBe(200);
    expect(denied.body.evaluation.allowed).toBe(false);
    expect(denied.body.evaluation.matched).toBe('deny');
  });
});
