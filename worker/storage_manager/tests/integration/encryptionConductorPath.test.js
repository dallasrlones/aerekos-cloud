const http = require('http');
const EncryptionService = require('../../api/services/EncryptionService');

/**
 * Exercises the real HTTP path storage_manager uses when MOCK_KEY_MANAGER is off:
 * GET ${CONDUCTOR_URL}/api/services/key_manager/api/keys/:name?project_id=…
 * with service JWT. A local stub replaces the full conductor+key_manager stack.
 */
describe('EncryptionService — conductor / key_manager proxy path', () => {
  let server;
  let port;
  const projectId = 'proj-integration-1';
  const keyName = 'storage-encryption-smoke';
  const hex64 = '0123456789abcdef'.repeat(4);
  let previousMock;

  beforeAll((done) => {
    previousMock = process.env.MOCK_KEY_MANAGER;
    process.env.MOCK_KEY_MANAGER = 'false';

    server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method !== 'GET' || u.pathname !== `/api/services/key_manager/api/keys/${keyName}`) {
        res.writeHead(404);
        return res.end();
      }
      if (u.searchParams.get('project_id') !== projectId) {
        res.writeHead(400);
        return res.end();
      }
      if (req.headers.authorization !== 'Bearer test-service-jwt') {
        res.writeHead(401);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          key_name: keyName,
          key_material: hex64,
          key_version: 1,
          algorithm: 'AES-256-GCM'
        })
      );
    });
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    if (previousMock === undefined) {
      delete process.env.MOCK_KEY_MANAGER;
    } else {
      process.env.MOCK_KEY_MANAGER = previousMock;
    }
    if (server) {
      server.close(() => done());
    } else {
      done();
    }
  });

  it('fetches key material from conductor key_manager proxy URL', async () => {
    const enc = new EncryptionService(`http://127.0.0.1:${port}`, 'test-service-jwt');
    const key = await enc.getEncryptionKey(keyName, projectId);
    expect(key.key_name).toBe(keyName);
    expect(key.key_material).toBe(hex64);
    expect(key.algorithm).toBe('AES-256-GCM');
  });
});
