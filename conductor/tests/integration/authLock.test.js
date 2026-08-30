const request = require('supertest');
const app = require('../../index');
const { setupTestDatabase, cleanupTestData, createTestUser } = require('../helpers/dbHelper');
const { hotp } = require('../../api/utils/totp');

describe('Auth lock — password change + TOTP', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('must_change_password blocks project list until reset', async () => {
    const username = `mustchange-${Date.now()}`;
    const user = await createTestUser({
      username,
      role: 'admin',
      must_change_password: 1,
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });
    expect(login.status).toBe(200);
    expect(login.body.must_change_password).toBe(true);
    const token = login.body.token;

    const blocked = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error?.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'testpass123', newPassword: 'newpass123' });
    expect(reset.status).toBe(200);

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'newpass123' });
    expect(relogin.status).toBe(200);
    const ok = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${relogin.body.token}`);
    expect(ok.status).toBe(200);
  });

  test('TOTP required on login after enable; valid code succeeds', async () => {
    const username = `totp-${Date.now()}`;
    await createTestUser({ username, role: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });
    expect(login.status).toBe(200);
    const token = login.body.token;

    const enable = await request(app)
      .post('/api/auth/totp/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(enable.status).toBe(200);
    expect(enable.body.secret).toBeTruthy();

    const denied = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });
    expect(denied.status).toBe(401);
    expect(denied.body.error?.code).toBe('TOTP_REQUIRED');

    const key = Buffer.from(enable.body.secret, 'hex');
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = hotp(key, counter);
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123', totp: code });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const disable = await request(app)
      .post('/api/auth/totp/disable')
      .set('Authorization', `Bearer ${ok.body.token}`)
      .send({});
    expect(disable.status).toBe(200);
  });
});
