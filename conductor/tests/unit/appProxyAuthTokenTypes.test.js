'use strict';

const jwt = require('jsonwebtoken');

jest.mock('../../api/models', () => ({ Service: { findAll: async () => [] } }));

const mockAuthenticate = jest.fn((req, res) => {
  res.status(401).json({ error: { message: 'Invalid token', status: 401 } });
});
jest.mock('../../api/middleware/auth', () => mockAuthenticate);

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');
const appProxyAuth = require('../../api/middleware/appProxyAuth');

const AUTH_ISSUER = 'aerekos-auth_manager';

function appJwt(extra = {}) {
  const payload = {
    iss: AUTH_ISSUER,
    typ: 'app',
    sub: 'cred-1',
    project_id: 'proj-1',
    ...extra,
  };
  return jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
}

function makeReq(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('appProxyAuth token classification', () => {
  const prevAuthUrl = process.env.AUTH_MANAGER_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_MANAGER_URL = 'http://auth_manager:3116';
  });

  afterAll(() => {
    process.env.AUTH_MANAGER_URL = prevAuthUrl;
  });

  test('InvalidAppToken when verify rejects app credential', async () => {
    const token = appJwt();
    axios.post.mockResolvedValue({ data: { active: false } });
    const req = makeReq(token);
    const res = makeRes();
    const next = jest.fn();
    await appProxyAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'InvalidAppToken',
          tokenType: 'app',
        }),
      }),
    );
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  test('conductor/user JWT with shared AUTH_ISSUER falls through to authenticate', async () => {
    // Login JWTs share iss aerekos-auth_manager with auth_manager; typ is not app.
    const token = jwt.sign({ iss: AUTH_ISSUER, typ: 'user', sub: 'x', id: 'u1' }, 's', { expiresIn: '1h' });
    const req = makeReq(token);
    const res = makeRes();
    const next = jest.fn();
    await appProxyAuth(req, res, next);
    expect(mockAuthenticate).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'WrongTokenType' }),
      }),
    );
  });

  test('WrongTokenType for typ app with wrong issuer', async () => {
    const token = jwt.sign({ iss: 'other-issuer', typ: 'app', sub: 'x' }, 's', { expiresIn: '1h' });
    const req = makeReq(token);
    const res = makeRes();
    const next = jest.fn();
    await appProxyAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'WrongTokenType' }),
      }),
    );
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  test('accepts verified app credential', async () => {
    const token = appJwt();
    axios.post.mockResolvedValue({
      data: {
        active: true,
        claims: { typ: 'app', project_id: 'proj-1', resources: [], scope: 'storage:read' },
      },
    });
    const req = makeReq(token);
    const res = makeRes();
    const next = jest.fn();
    await appProxyAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.tokenType).toBe('app');
    expect(req.isAppCredential).toBe(true);
  });
});
