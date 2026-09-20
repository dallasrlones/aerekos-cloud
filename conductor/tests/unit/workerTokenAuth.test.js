'use strict';

jest.mock('../../api/middleware/auth', () => (req, res) => {
  res.status(401).json({ error: { message: 'Invalid token', status: 401 } });
});

const { authenticateWorkerOrUser, workerTokenOk } = require('../../api/middleware/workerTokenAuth');

describe('authenticateWorkerOrUser', () => {
  const prev = process.env.WORKER_TOKEN;
  beforeAll(() => { process.env.WORKER_TOKEN = 'worker-shared-token'; });
  afterAll(() => { process.env.WORKER_TOKEN = prev; });

  test('accepts WORKER_TOKEN so FleetExec can call /api/workers/:id/containers', () => {
    const req = { headers: { authorization: 'Bearer worker-shared-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticateWorkerOrUser(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.tokenType).toBe('service');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('rejects a random bearer and falls through to JWT auth', () => {
    const req = { headers: { authorization: 'Bearer not-the-worker-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticateWorkerOrUser(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('workerTokenOk is exact-match only', () => {
    expect(workerTokenOk('worker-shared-token')).toBe(true);
    expect(workerTokenOk('worker-shared-token-extra')).toBe(false);
  });
});
