/**
 * Authentication helpers for integration tests — the "login" step of the
 * cucumber-style flow (login, then do X, then do Y).
 *
 * Usage:
 *   const { login, loginAsAdmin } = require('../helpers/auth');
 *   const { createApiClient } = require('../helpers/apiClient');
 *
 *   beforeAll(async () => {
 *     await setupTestDatabase();
 *     session = await loginAsAdmin(app);           // create user + log in via the real auth API
 *     api = createApiClient(app, session.token);   // every request now carries the Bearer token
 *   });
 */
const request = require('supertest');
const { User } = require('../../api/models');
const { hashPassword } = require('../../api/utils/password');
const { createTestUser } = require('./dbHelper');

const TEST_PASSWORD = 'testpass123';

/**
 * Create a test user (or reuse one with the given `username`) and log in
 * through the REAL auth endpoint (POST /api/auth/login), so the whole
 * JWT/validation path is exercised.
 *
 *   login(app, { role: 'admin' })
 *   login(app, { username: 'alice', role: 'user', password: 'secret' })
 *
 * Returns: { token, user: { id, username, role }, headers: { Authorization } }
 * Throws if the login request does not return 200.
 */
async function login(app, { username, role = 'user', password = TEST_PASSWORD } = {}) {
  let user = null;
  if (username) {
    const existing = await User.findAll({ where: { username } });
    user = existing[0] || null;
  }
  if (!user) {
    user = await createTestUser({
      username: username || `testuser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: `testuser-${Date.now()}@example.com`,
      role,
      password_hash: await hashPassword(password),
    });
  }
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: user.username, password });
  if (res.status !== 200) {
    throw new Error(`login failed: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return {
    token: res.body.token,
    user: {
      id: (res.body.user && res.body.user.id) || user.id,
      username: user.username,
      role,
    },
    headers: { Authorization: `Bearer ${res.body.token}` },
  };
}

/** Convenience: login with an admin-role user. */
const loginAsAdmin = (app, overrides = {}) => login(app, { role: 'admin', ...overrides });

module.exports = { login, loginAsAdmin, TEST_PASSWORD };
