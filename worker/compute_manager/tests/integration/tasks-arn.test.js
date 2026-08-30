const request = require('supertest');
const express = require('express');
const { TaskService } = require('../../api/services/TaskService');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

jest.mock('../../api/services/TaskService');
jest.mock('../../../shared/authManagerClient', () => ({
  requireAuth: () => (req, res, next) => {
    req.auth = { typ: 'service', sub: 'test' };
    next();
  },
}));

describe('compute_manager task ARN', () => {
  let app;
  let mockService;

  beforeEach(() => {
    mockService = {
      createTask: jest.fn(),
      list: jest.fn(),
      getById: jest.fn(),
    };
    TaskService.mockImplementation(() => mockService);

    delete require.cache[require.resolve('../../api/routes/tasks')];
    delete require.cache[require.resolve('../../api/routes/index')];
    const routes = require('../../api/routes/index');

    app = express();
    app.use(express.json());
    app.use('/api/v1', routes);
  });

  test('create returns arn + invoke_scope', async () => {
    const name = 'batch-etl';
    const row = {
      id: 't1',
      name,
      project_id: PID,
      image: 'alpine',
      command: '[]',
      env: '{}',
      port_bindings: '{}',
      run_mode: 'oneshot',
      status: 'pending',
      container_id: '',
      exit_code: -1,
      error_message: '',
    };
    mockService.createTask.mockResolvedValue(row);

    const r = await request(app)
      .post('/api/v1/tasks')
      .query({ project_id: PID })
      .send({ name, image: 'alpine', run_mode: 'oneshot' });

    expect(r.status).toBe(201);
    expect(r.body.task.arn).toBe(`arn:aerekos:${PID}:compute:task/${name}`);
    expect(r.body.task.invoke_scope.run).toBe('compute:Run');
  });
});
