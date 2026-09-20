'use strict';

jest.mock('../../api/models', () => ({ Service: { findAll: async () => [] } }));
jest.mock('../../api/middleware/auth', () => (req, res) => {
  res.status(401).json({ error: { message: 'Invalid token', status: 401 } });
});

const appProxyAuth = require('../../api/middleware/appProxyAuth');

describe('appProxyAuth worker token', () => {
  const prev = process.env.WORKER_TOKEN;
  beforeAll(() => { process.env.WORKER_TOKEN = 'worker-shared-token'; });
  afterAll(() => { process.env.WORKER_TOKEN = prev; });

  test('accepts WORKER_TOKEN so managers can proxy without a JWT', async () => {
    const req = { headers: { authorization: 'Bearer worker-shared-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await appProxyAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.tokenType).toBe('service');
    expect(res.status).not.toHaveBeenCalled();
  });
});
