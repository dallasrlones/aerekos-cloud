jest.mock('axios');

const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const request = require('supertest');

const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

function toBuf(data) {
  if (data == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (typeof data === 'string') return Buffer.from(data);
  return Buffer.from(JSON.stringify(data));
}

function installStorageMock(diskRoot) {
  const objects = new Map();
  const buckets = new Set();

  function diskPath(bucket, key) {
    return path.join(diskRoot, bucket, key);
  }

  function put(bucket, key, buf) {
    const file = diskPath(bucket, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    objects.set(`${bucket}::${key}`, buf);
    buckets.add(bucket);
  }

  function get(bucket, key) {
    const file = diskPath(bucket, key);
    if (fs.existsSync(file)) return fs.readFileSync(file);
    return objects.get(`${bucket}::${key}`) || null;
  }

  function list(bucket, prefix) {
    const out = [];
    const pre = prefix || '';
    for (const k of objects.keys()) {
      const [b, key] = k.split('::');
      if (b !== bucket) continue;
      if (pre && !key.startsWith(pre)) continue;
      out.push({ key, size: (objects.get(k) || Buffer.alloc(0)).length });
    }
    if (fs.existsSync(path.join(diskRoot, bucket))) {
      const walk = (dir, rel) => {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          const relKey = rel ? `${rel}/${name}` : name;
          if (fs.statSync(full).isDirectory()) walk(full, relKey);
          else if (!pre || relKey.startsWith(pre)) {
            if (!out.some((f) => f.key === relKey)) {
              out.push({ key: relKey, size: fs.statSync(full).size });
            }
          }
        }
      };
      walk(path.join(diskRoot, bucket), '');
    }
    return out;
  }

  async function handle(config = {}) {
    const method = String(config.method || 'get').toLowerCase();
    const url = new URL(config.url, 'http://conductor.test');
    const pathname = url.pathname;
    const storage = pathname.match(
      /^\/api\/services\/storage_manager\/api\/projects\/([^/]+)\/buckets(?:\/([^/]+)(?:\/files(?:\/(.*))?)?)?$/
    );
    if (!storage) {
      return { status: 404, data: { error: { message: `unmocked ${method} ${pathname}` } }, headers: {} };
    }
    const bucket = storage[2] ? decodeURIComponent(storage[2]) : '';
    let key = storage[3] ? decodeURIComponent(storage[3]) : '';
    if (key.endsWith('/signed-url/download')) {
      return {
        status: 201,
        data: { url: 'http://signed.example/snapshot.json', expires_at: new Date(Date.now() + 3600e3).toISOString() },
        headers: {},
      };
    }
    if (!bucket) {
      if (method === 'post') {
        const name = (config.data && config.data.name) || '';
        buckets.add(name);
        fs.mkdirSync(path.join(diskRoot, name), { recursive: true });
        return { status: 201, data: { name }, headers: {} };
      }
      return { status: 200, data: { buckets: [...buckets].map((name) => ({ name })) }, headers: {} };
    }
    if (!key) {
      const prefix = url.searchParams.get('prefix') || '';
      const files = list(bucket, prefix);
      return { status: 200, data: { files, folders: [], hasMore: false, count: files.length }, headers: {} };
    }
    if (method === 'get') {
      const buf = get(bucket, key);
      if (!buf) return { status: 404, data: { error: { message: `File '${key}' not found` } }, headers: {} };
      return { status: 200, data: buf, headers: { 'content-type': 'application/octet-stream' } };
    }
    if (method === 'post' || method === 'put') {
      const buf = toBuf(config.data);
      put(bucket, key, buf);
      return { status: 201, data: { key, size: buf.length }, headers: {} };
    }
    return { status: 405, data: { error: { message: 'method' } }, headers: {} };
  }

  axios.mockImplementation(handle);
  axios.get.mockImplementation((url, cfg) => handle({ ...(cfg || {}), method: 'get', url }));
  axios.post.mockImplementation((url, data, cfg) => handle({ ...(cfg || {}), method: 'post', url, data }));
  axios.put.mockImplementation((url, data, cfg) => handle({ ...(cfg || {}), method: 'put', url, data }));

  return { put, get, list, objects, buckets };
}

describe('backup_manager jobs + restore', () => {
  const pid = 'p-backup-jobs-' + Date.now();
  let disk;
  let mock;

  beforeAll(() => {
    disk = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-backup-store-'));
  });

  afterAll(() => {
    try { fs.rmSync(disk, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  beforeEach(() => {
    mock = installStorageMock(disk);
    mock.put('src-bucket', 'hello.txt', Buffer.from('hello-bytes'));
  });

  test('refuses key_manager dumps', async () => {
    const res = await request(app).post('/api/v1/jobs').send({
      project_id: pid,
      source: 'key_manager',
      resource: 'master',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/key_manager/);
  });

  test('snapshot write + restore round-trip', async () => {
    const created = await request(app).post('/api/v1/jobs').send({
      project_id: pid,
      source: 'storage_manager',
      resource: 'src-bucket',
      vault: 'default',
    });
    expect(created.status).toBe(201);
    const job = created.body.job;
    expect(job.status).toBe('completed');
    expect(job.storage_key).toMatch(/^storage_manager\/src-bucket\//);
    expect(Number(job.size_bytes)).toBeGreaterThan(0);

    const listed = await request(app).get('/api/v1/jobs?' + Q(pid));
    expect(listed.status).toBe(200);
    expect(listed.body.jobs.some((j) => j.id === job.id)).toBe(true);

    const got = await request(app).get(`/api/v1/jobs/${job.id}?` + Q(pid));
    expect(got.status).toBe(200);
    expect(got.body.job.download_url).toBe('http://signed.example/snapshot.json');

    const snapshot = mock.get('aerekos-backups', `${job.storage_key}/snapshot.json`);
    expect(snapshot).toBeTruthy();
    const manifest = JSON.parse(snapshot.toString('utf8'));
    expect(manifest.objects.some((o) => o.key === 'hello.txt')).toBe(true);
    expect(mock.get('aerekos-backups', `${job.storage_key}/objects/hello.txt`).toString()).toBe('hello-bytes');

    const restored = await request(app).post(`/api/v1/jobs/${job.id}/restore`).send({
      project_id: pid,
      dest: 'restored-bucket',
    });
    expect(restored.status).toBe(200);
    expect(restored.body.restore.ok).toBe(true);
    expect(mock.get('restored-bucket', 'hello.txt').toString()).toBe('hello-bytes');
  });
});
