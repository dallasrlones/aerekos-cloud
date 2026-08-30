const request = require('supertest');
const express = require('express');
const { RepoService } = require('../../api/services/RepoService');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

jest.mock('../../api/services/RepoService');
jest.mock('../../../shared/authManagerClient', () => ({
  requireAuth: () => (req, res, next) => {
    req.auth = { typ: 'service', sub: 'test' };
    next();
  },
}));

describe('git_manager repository ARN', () => {
  let app;

  beforeEach(() => {
    RepoService.mockImplementation(() => ({
      create: jest.fn().mockResolvedValue({
        id: 'r1',
        project_id: PID,
        name: 'my-app',
        arn: `arn:aerekos:${PID}:git:repository/my-app`,
        invoke_scope: { read: 'git:Read', push: 'git:Push', admin: 'git:Admin' },
        description: null,
        default_branch: 'main',
        visibility: 'private',
        last_pushed_at: null,
        clone_path: `/git/${PID}/my-app.git`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }));

    delete require.cache[require.resolve('../../api/routes/repos')];
    delete require.cache[require.resolve('../../api/routes/index')];
    const routes = require('../../api/routes/index');

    app = express();
    app.use(express.json());
    app.use('/api/v1', routes);
  });

  test('create returns arn + invoke_scope', async () => {
    const r = await request(app)
      .post('/api/v1/repos')
      .query({ project_id: PID })
      .send({ name: 'my-app' });

    expect(r.status).toBe(201);
    expect(r.body.repository.arn).toBe(`arn:aerekos:${PID}:git:repository/my-app`);
    expect(r.body.repository.invoke_scope.read).toBe('git:Read');
  });
});
