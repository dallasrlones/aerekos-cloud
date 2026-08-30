'use strict';

const { loginRateLimit, _resetForTests } = require('../../api/middleware/loginRateLimit');

function mockRes() {
  const res = { statusCode: 200, headers: {} };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('loginRateLimit', () => {
  beforeEach(() => _resetForTests());

  test('allows under the cap then 429s', () => {
    process.env.LOGIN_RATE_FORCE = '1';
    process.env.LOGIN_RATE_MAX = '3';
    process.env.LOGIN_RATE_WINDOW_MS = '60000';
    const req = { ip: '1.2.3.4', body: { username: 'admin' }, headers: {} };
    let nextCount = 0;
    const next = () => { nextCount += 1; };
    for (let i = 0; i < 3; i += 1) loginRateLimit(req, mockRes(), next);
    expect(nextCount).toBe(3);
    const res = mockRes();
    loginRateLimit(req, res, next);
    expect(res.statusCode).toBe(429);
    expect(res.body.error.code).toBe('LOGIN_RATE_LIMITED');
    delete process.env.LOGIN_RATE_MAX;
    delete process.env.LOGIN_RATE_WINDOW_MS;
    delete process.env.LOGIN_RATE_FORCE;
  });
});
