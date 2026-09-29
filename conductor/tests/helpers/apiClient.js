/**
 * Authenticated API client for supertest-based integration tests.
 *
 * Wraps every request with the session's Bearer token and returns
 * supertest response objects ({ status, body, ... }) so tests assert
 * exactly as they always have.
 *
 *   const session = await loginAsAdmin(app);
 *   const api = createApiClient(app, session.token);
 *
 *   const res = await api.get('/api/projects');
 *   expect(res.status).toBe(200);
 *
 *   await api.post(`/api/projects/${id}/infra/apply`, { file });
 *   await api.del(`/api/projects/${id}`);
 *
 * `api.as(otherToken)` returns a client bound to a different user
 * (multi-user tests: permission checks etc.).
 */
const request = require('supertest');

function createApiClient(app, token = null) {
  const authed = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    token,
    /** Re-bind the client to a different token (a different user). */
    as: (newToken) => createApiClient(app, newToken),
    get: (path, { query } = {}) => authed(request(app).get(path).query(query || {})),
    post: (path, body = {}) => authed(request(app).post(path).send(body)),
    put: (path, body = {}) => authed(request(app).put(path).send(body)),
    patch: (path, body = {}) => authed(request(app).patch(path).send(body)),
    del: (path, body = {}) => authed(request(app).delete(path).send(body)),
  };
}

module.exports = { createApiClient };
